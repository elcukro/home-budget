"""
AI Chat Router - WebSocket + REST endpoints for AI Financial Advisor.
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from sqlalchemy.orm import Session
import jwt

from ..database import get_db
from ..models import User, AIConversation
from ..dependencies import JWT_SECRET, JWT_ALGORITHM, get_current_user
from ..services.subscription_service import SubscriptionService
from ..services.ai_chat_service import (
    check_and_increment_quota,
    get_quota_info,
    get_or_create_conversation,
    get_conversation_history,
    save_messages,
    stream_claude_response,
)

logger = logging.getLogger(__name__)
router = APIRouter()


async def authenticate_ws_user(token: str, db: Session):
    """Authenticate WebSocket user via JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub") or payload.get("userId")
        if not email:
            return None
        user = db.query(User).filter(User.email == email).first()
        return user
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        return None


@router.websocket("/ai/ws")
async def chat_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """WebSocket chat endpoint for AI financial advisor."""
    user = await authenticate_ws_user(token, db)
    if not user:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    logger.info(f"AI WebSocket connected for user {user.id}")

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue

            message_content = data.get("content", "").strip()
            conversation_id = data.get("conversation_id")

            if not message_content:
                continue

            # Check premium subscription
            sub = SubscriptionService.get_subscription(user.id, db)
            if not SubscriptionService.is_premium(sub):
                await websocket.send_json({
                    "type": "error",
                    "message": "Premium subscription required for AI advisor"
                })
                continue

            # Rate limit check + increment
            allowed, used, limit = check_and_increment_quota(user.id, db)
            if not allowed:
                await websocket.send_json({
                    "type": "quota_exceeded",
                    "queries_used": used,
                    "queries_limit": limit
                })
                continue

            # Load or create conversation
            conv = get_or_create_conversation(user.id, conversation_id, db)
            history = get_conversation_history(conv, db)

            # Stream response
            full_response = ""
            try:
                async for frame in stream_claude_response(user, message_content, history, db):
                    await websocket.send_json(frame)
                    if frame.get("type") == "token":
                        full_response += frame.get("content", "")

                # Save messages to DB
                save_messages(conv, message_content, full_response, db)

                # Send done frame
                await websocket.send_json({
                    "type": "done",
                    "conversation_id": conv.id,
                    "queries_used": used,
                    "queries_limit": limit,
                })

            except Exception as e:
                logger.error(f"Error streaming response: {e}", exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "message": "Wystapil blad podczas generowania odpowiedzi"
                })

    except WebSocketDisconnect:
        logger.info(f"AI WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"AI WebSocket error: {e}", exc_info=True)


@router.get("/ai/conversations")
async def list_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List user's AI conversations."""
    conversations = db.query(AIConversation).filter(
        AIConversation.user_id == user.id
    ).order_by(AIConversation.updated_at.desc()).limit(50).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat() if c.updated_at else c.created_at.isoformat(),
        }
        for c in conversations
    ]


@router.get("/ai/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full conversation with messages."""
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": conv.id,
        "title": conv.title,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in conv.messages
        ]
    }


@router.get("/ai/quota")
async def get_ai_quota(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current AI query quota."""
    used, limit = get_quota_info(user.id, db)
    return {"used": used, "limit": limit}
