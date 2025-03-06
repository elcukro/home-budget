from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

async def get_current_user(
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
) -> User:
    """Get the current user from the database using the X-User-ID header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-User-ID header is required"
        )
    
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found with ID: {x_user_id}"
        )
    
    return user 