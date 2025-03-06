from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timedelta
import uuid

from ..database import get_db
from ..models import User, Account, Session as UserSession, VerificationToken
from ..schemas.auth import (
    UserAuth, UserResponse, AccountCreate, AccountResponse,
    SessionCreate, SessionResponse, VerificationTokenCreate, VerificationTokenResponse
)

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/users", response_model=UserResponse)
async def create_user(user: UserAuth, db: Session = Depends(get_db)):
    """Create a new user or return existing one."""
    try:
        db_user = User(
            id=str(uuid.uuid4()),
            email=user.email,
            name=user.name
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError:
        db.rollback()
        db_user = db.query(User).filter(User.email == user.email).first()
        if not db_user:
            raise HTTPException(status_code=400, detail="Error creating user")
        return db_user

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get user by ID."""
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.post("/accounts", response_model=AccountResponse)
async def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    """Create a new OAuth account."""
    try:
        db_account = Account(
            id=str(uuid.uuid4()),
            **account.model_dump()
        )
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Account already exists")

@router.get("/accounts/{provider}/{provider_account_id}", response_model=AccountResponse)
async def get_account(provider: str, provider_account_id: str, db: Session = Depends(get_db)):
    """Get account by provider and provider account ID."""
    db_account = db.query(Account).filter(
        Account.provider == provider,
        Account.provider_account_id == provider_account_id
    ).first()
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    return db_account

@router.post("/sessions", response_model=SessionResponse)
async def create_session(session: SessionCreate, db: Session = Depends(get_db)):
    """Create a new session."""
    try:
        db_session = UserSession(
            id=str(uuid.uuid4()),
            **session.model_dump()
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error creating session")

@router.get("/sessions/{session_token}", response_model=SessionResponse)
async def get_session(session_token: str, db: Session = Depends(get_db)):
    """Get session by token."""
    db_session = db.query(UserSession).filter(UserSession.session_token == session_token).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
    if db_session.expires < datetime.utcnow():
        db.delete(db_session)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired")
    return db_session

@router.put("/sessions/{session_token}", response_model=SessionResponse)
async def update_session(session_token: str, session: SessionCreate, db: Session = Depends(get_db)):
    """Update a session."""
    try:
        db_session = db.query(UserSession).filter(UserSession.session_token == session_token).first()
        if not db_session:
            raise HTTPException(status_code=404, detail="Session not found")

        for key, value in session.model_dump().items():
            setattr(db_session, key, value)

        db.commit()
        db.refresh(db_session)
        return db_session
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error updating session")

@router.delete("/sessions/{session_token}")
async def delete_session(session_token: str, db: Session = Depends(get_db)):
    """Delete a session."""
    db_session = db.query(UserSession).filter(UserSession.session_token == session_token).first()
    if db_session:
        db.delete(db_session)
        db.commit()
    return {"status": "success"}

@router.post("/verification-tokens", response_model=VerificationTokenResponse)
async def create_verification_token(token: VerificationTokenCreate, db: Session = Depends(get_db)):
    """Create a new verification token."""
    try:
        db_token = VerificationToken(**token.model_dump())
        db.add(db_token)
        db.commit()
        db.refresh(db_token)
        return db_token
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error creating verification token")

@router.get("/verification-tokens/{token}", response_model=VerificationTokenResponse)
async def get_verification_token(token: str, db: Session = Depends(get_db)):
    """Get verification token."""
    db_token = db.query(VerificationToken).filter(VerificationToken.token == token).first()
    if not db_token:
        raise HTTPException(status_code=404, detail="Token not found")
    if db_token.expires < datetime.utcnow():
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=401, detail="Token expired")
    return db_token

@router.delete("/verification-tokens/{token}")
async def delete_verification_token(token: str, db: Session = Depends(get_db)):
    """Delete a verification token."""
    db_token = db.query(VerificationToken).filter(VerificationToken.token == token).first()
    if db_token:
        db.delete(db_token)
        db.commit()
    return {"status": "success"}

@router.post("/verify-email/{user_id}")
async def verify_email(user_id: str, token: str, db: Session = Depends(get_db)):
    """Verify user email with token."""
    db_token = db.query(VerificationToken).filter(
        VerificationToken.token == token,
        VerificationToken.identifier == user_id
    ).first()
    
    if not db_token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if db_token.expires < datetime.utcnow():
        db.delete(db_token)
        db.commit()
        raise HTTPException(status_code=401, detail="Token expired")
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_user.email_verified = datetime.utcnow()
    db.delete(db_token)
    db.commit()
    
    return {"status": "success"}

@router.delete("/accounts/{provider}/{provider_account_id}")
async def unlink_account(provider: str, provider_account_id: str, db: Session = Depends(get_db)):
    """Unlink an OAuth account."""
    db_account = db.query(Account).filter(
        Account.provider == provider,
        Account.provider_account_id == provider_account_id
    ).first()
    
    if db_account:
        db.delete(db_account)
        db.commit()
    
    return {"status": "success"} 