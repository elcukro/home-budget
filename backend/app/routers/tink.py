"""
Tink API Router

Handles Tink OAuth flow and bank connection management.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkConnection, BankTransaction
from ..services.tink_service import tink_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/banking/tink",
    tags=["tink"],
    responses={404: {"description": "Not found"}},
)


# Pydantic models
class ConnectRequest(BaseModel):
    locale: str = "en_US"


class ConnectResponse(BaseModel):
    tink_link_url: str
    state: str


class CallbackRequest(BaseModel):
    code: str  # Authorization code from OAuth callback
    state: str
    credentials_id: Optional[str] = None  # Optional from Tink callback


class AccountDetail(BaseModel):
    id: str
    name: Optional[str] = None
    iban: Optional[str] = None
    currency: Optional[str] = None
    type: Optional[str] = None


class TinkConnectionResponse(BaseModel):
    id: int
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    accounts: List[AccountDetail] = []

    class Config:
        from_attributes = True


class CallbackResponse(BaseModel):
    success: bool
    connection_id: int
    accounts: List[AccountDetail]
    message: str


class DisconnectResponse(BaseModel):
    success: bool
    message: str


# Endpoints

@router.post("/connect", response_model=ConnectResponse)
async def initiate_connection(
    request: ConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate Tink Link flow to connect user's bank account.

    Returns a URL to redirect the user to Tink Link.
    """
    try:
        tink_link_url, state = await tink_service.generate_connect_url(
            user_id=current_user.id,
            locale=request.locale
        )

        return ConnectResponse(
            tink_link_url=tink_link_url,
            state=state
        )

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error initiating Tink connection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error initiating connection: {str(e)}")


@router.post("/callback", response_model=CallbackResponse)
async def handle_callback(
    request: CallbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Handle OAuth callback from Tink after user authorization.

    Exchanges the authorization code for tokens and creates the connection.
    """
    try:
        # Verify state token
        stored_user_id = tink_service.verify_state_token(request.state)
        if not stored_user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired state token")

        if stored_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="State token does not match current user")

        # Create connection using stored auth code (NOT the callback code)
        connection = await tink_service.create_connection_from_callback(
            db=db,
            user_id=current_user.id,
            state=request.state,
            credentials_id=request.credentials_id,
        )

        # Format account details for response
        accounts = []
        if connection.account_details:
            for acc_id, details in connection.account_details.items():
                accounts.append(AccountDetail(
                    id=acc_id,
                    name=details.get("name"),
                    iban=details.get("iban"),
                    currency=details.get("currency"),
                    type=details.get("type"),
                ))

        return CallbackResponse(
            success=True,
            connection_id=connection.id,
            accounts=accounts,
            message="Bank account connected successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling Tink callback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error connecting bank account: {str(e)}")


@router.get("/callback")
async def handle_callback_redirect(
    code: str = Query(..., description="Authorization code from Tink"),
    state: str = Query(..., description="State token for CSRF protection"),
):
    """
    Handle GET callback redirect from Tink Link.

    This endpoint is called by Tink Link after user authorization.
    The frontend should catch this redirect and call POST /callback with the code.
    """
    # This is just a placeholder - the frontend handles the redirect
    # and calls POST /callback with proper authentication
    return {
        "message": "Callback received. Frontend should handle this.",
        "code": code[:10] + "...",  # Don't expose full code
        "state": state[:10] + "..."
    }


@router.get("/connections", response_model=List[TinkConnectionResponse])
async def get_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all Tink connections for the current user.
    """
    try:
        connections = db.query(TinkConnection).filter(
            TinkConnection.user_id == current_user.id,
            TinkConnection.is_active == True
        ).all()

        result = []
        for conn in connections:
            accounts = []
            if conn.account_details:
                for acc_id, details in conn.account_details.items():
                    accounts.append(AccountDetail(
                        id=acc_id,
                        name=details.get("name"),
                        iban=details.get("iban"),
                        currency=details.get("currency"),
                        type=details.get("type"),
                    ))

            result.append(TinkConnectionResponse(
                id=conn.id,
                is_active=conn.is_active,
                last_sync_at=conn.last_sync_at,
                created_at=conn.created_at,
                accounts=accounts
            ))

        return result

    except Exception as e:
        logger.error(f"Error fetching Tink connections: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching connections: {str(e)}")


@router.delete("/connections/{connection_id}", response_model=DisconnectResponse)
async def disconnect(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect a Tink connection (soft delete).
    """
    try:
        connection = db.query(TinkConnection).filter(
            TinkConnection.id == connection_id,
            TinkConnection.user_id == current_user.id
        ).first()

        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")

        # Soft delete
        connection.is_active = False
        db.commit()

        return DisconnectResponse(
            success=True,
            message="Bank connection disconnected successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting Tink connection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error disconnecting: {str(e)}")


@router.get("/test")
async def test_tink_api(
    current_user: User = Depends(get_current_user),
):
    """Test if the Tink API router is working."""
    return {
        "status": "ok",
        "message": "Tink API is configured",
        "client_id_set": bool(tink_service.client_id),
        "client_secret_set": bool(tink_service.client_secret),
        "redirect_uri": tink_service.redirect_uri,
        "timestamp": datetime.now().isoformat()
    }
