import os
import jwt
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

# JWT configuration (must match auth.py)
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-use-strong-secret")
JWT_ALGORITHM = "HS256"


async def get_current_user(
    authorization: str = Header(None, alias="Authorization"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current user from the database.

    Supports two authentication methods:
    1. Bearer token (Authorization header) - for mobile app
    2. X-User-ID header - for web app (via Next.js API routes)

    Bearer token takes precedence if both are provided.
    """
    user_identifier = None
    lookup_by_email = False

    # Method 1: Bearer token (mobile app)
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_identifier = payload.get("sub")  # This is email
            lookup_by_email = True

            if not user_identifier:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing subject"
                )

        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}"
            )

    # Method 2: X-User-ID header (web app)
    elif x_user_id:
        user_identifier = x_user_id
        # X-User-ID contains email (from NextAuth session)
        lookup_by_email = True

    # No auth provided
    if not user_identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Look up user
    if lookup_by_email:
        user = db.query(User).filter(User.email == user_identifier).first()
        # Fallback: try by ID for backwards compatibility
        if not user:
            user = db.query(User).filter(User.id == user_identifier).first()
    else:
        user = db.query(User).filter(User.id == user_identifier).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {user_identifier}"
        )

    return user
