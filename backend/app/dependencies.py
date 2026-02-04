import os
import logging
from datetime import datetime, timezone
import jwt
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

logger = logging.getLogger(__name__)

# JWT configuration (must match auth.py)
# SECURITY: In production, JWT_SECRET must be set via environment variable
_jwt_secret = os.getenv("JWT_SECRET")
_environment = os.getenv("ENVIRONMENT", "development")

if not _jwt_secret:
    if _environment == "production":
        raise ValueError(
            "CRITICAL: JWT_SECRET environment variable is required in production. "
            "Generate a secure secret with: openssl rand -base64 32"
        )
    # Only use weak default in development/testing
    _jwt_secret = "change-me-in-production-use-strong-secret"

JWT_SECRET = _jwt_secret
JWT_ALGORITHM = "HS256"

# Internal service secret - required for X-User-ID header authentication
# This prevents direct API access with spoofed X-User-ID headers
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET")


async def get_current_user(
    authorization: str = Header(None, alias="Authorization"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
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
        except jwt.InvalidTokenError:
            # SECURITY: Don't expose token parsing details
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

    # Method 2: X-User-ID header (web app via Next.js proxy)
    # SECURITY: Requires matching X-Internal-Secret to prevent header spoofing
    elif x_user_id:
        if not INTERNAL_SERVICE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service configuration error"
            )
        if x_internal_secret != INTERNAL_SERVICE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
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
        # SECURITY: Don't expose which user was requested
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


async def get_or_create_current_user(
    authorization: str = Header(None, alias="Authorization"),
    x_user_id: str = Header(None, alias="X-User-ID"),
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db)
) -> User:
    """
    Get or create the current user. Same as get_current_user but auto-creates
    new users on first login (for OAuth registration flow).
    """
    from . import models  # Import here to avoid circular imports

    user_identifier = None
    lookup_by_email = False

    # Method 1: Bearer token (mobile app)
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_identifier = payload.get("sub")
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
        except jwt.InvalidTokenError:
            # SECURITY: Don't expose token parsing details
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

    # Method 2: X-User-ID header (web app via Next.js proxy)
    elif x_user_id:
        if not INTERNAL_SERVICE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Service configuration error"
            )
        if x_internal_secret != INTERNAL_SERVICE_SECRET:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
        user_identifier = x_user_id
        lookup_by_email = True

    if not user_identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    # Look up user
    if lookup_by_email:
        user = db.query(User).filter(User.email == user_identifier).first()
        if not user:
            user = db.query(User).filter(User.id == user_identifier).first()
    else:
        user = db.query(User).filter(User.id == user_identifier).first()

    # Auto-create user if not found (OAuth registration)
    is_new_user = False
    if not user:
        is_new_user = True
        user = User(
            id=user_identifier,
            email=user_identifier,
            name=user_identifier.split('@')[0] if '@' in user_identifier else None
        )
        db.add(user)

        # Create default settings
        settings = models.Settings(
            user_id=user_identifier,
            language="pl",
            currency="PLN",
            ai={"apiKey": None},
            emergency_fund_target=1000,
            emergency_fund_months=3,
            base_currency="PLN"
        )
        db.add(settings)

        db.commit()
        db.refresh(user)

    # Send welcome email for new users or users who haven't received it yet
    if is_new_user or not user.welcome_email_sent_at:
        try:
            from .services.email_service import send_welcome_email
            from .routers.stripe_billing import ensure_subscription_exists

            # Get subscription to find trial end date
            subscription = ensure_subscription_exists(user.id, db)
            trial_end = subscription.trial_end if subscription else None

            if send_welcome_email(user.email, user.name, trial_end):
                user.welcome_email_sent_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"Welcome email sent to user {user.id}")
        except Exception as e:
            # Don't fail auth if email fails
            logger.error(f"Failed to send welcome email to user {user.id}: {e}")

    return user
