from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timedelta
import uuid
import os
import jwt
import httpx
import logging
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import get_db
from ..models import User, Account, Session as UserSession, VerificationToken

logger = logging.getLogger(__name__)

# Rate limiter for auth endpoints (stricter limits to prevent brute force)
limiter = Limiter(key_func=get_remote_address)
from ..schemas.auth import (
    UserAuth, UserResponse, AccountCreate, AccountResponse,
    SessionCreate, SessionResponse, VerificationTokenCreate, VerificationTokenResponse
)

# JWT configuration for mobile auth
# Import shared JWT config from dependencies to ensure consistency
from ..dependencies import JWT_SECRET, JWT_ALGORITHM
# SECURITY: Reduced from 30 days to 7 days for better security
JWT_EXPIRATION_DAYS = 7

# Google OAuth client IDs (add your mobile app client IDs)
GOOGLE_CLIENT_IDS = [
    os.getenv("GOOGLE_WEB_CLIENT_ID", ""),
    os.getenv("GOOGLE_IOS_CLIENT_ID", ""),
    os.getenv("GOOGLE_ANDROID_CLIENT_ID", ""),
]

# Google's public keys endpoint for token verification
GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
# Cache for Google's public keys
_google_certs_cache = {"keys": None, "expires_at": None}


class MobileGoogleAuthRequest(BaseModel):
    """Request body for mobile Google authentication."""
    id_token: str


class MobileAuthResponse(BaseModel):
    """Response for mobile authentication."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


router = APIRouter(prefix="/auth", tags=["auth"])


# ============== Mobile Auth Helpers ==============

async def get_google_public_keys() -> dict:
    """
    Fetch Google's public keys for JWT verification.
    Keys are cached for 1 hour to reduce API calls.
    """
    global _google_certs_cache

    now = datetime.utcnow()

    # Return cached keys if still valid
    if _google_certs_cache["keys"] and _google_certs_cache["expires_at"]:
        if now < _google_certs_cache["expires_at"]:
            return _google_certs_cache["keys"]

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(GOOGLE_CERTS_URL, timeout=10.0)
            if response.status_code != 200:
                logger.error(f"Failed to fetch Google certs: {response.status_code}")
                # Return cached keys if available, even if expired
                if _google_certs_cache["keys"]:
                    return _google_certs_cache["keys"]
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Unable to verify token at this time"
                )

            certs_data = response.json()

            # Cache for 1 hour
            _google_certs_cache["keys"] = certs_data
            _google_certs_cache["expires_at"] = now + timedelta(hours=1)

            return certs_data

    except httpx.RequestError as e:
        logger.error(f"Error fetching Google certs: {e}")
        # Return cached keys if available
        if _google_certs_cache["keys"]:
            return _google_certs_cache["keys"]
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify token at this time"
        )


async def verify_google_token(id_token: str) -> dict:
    """
    Verify Google ID token using local JWT verification.

    SECURITY: Uses Google's public keys to verify the token signature locally,
    instead of calling the deprecated tokeninfo endpoint.
    """
    try:
        # Try to use google-auth library if available (more robust)
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            # Get configured client IDs
            configured_ids = [cid for cid in GOOGLE_CLIENT_IDS if cid]

            # Verify with first configured client ID
            if configured_ids:
                request = google_requests.Request()
                idinfo = google_id_token.verify_oauth2_token(
                    id_token, request, configured_ids[0]
                )

                # If multiple client IDs configured, verify audience matches one of them
                if idinfo.get("aud") not in configured_ids:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token"
                    )

                if not idinfo.get("email"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token"
                    )

                return idinfo
            else:
                # No client IDs configured, verify without audience check
                request = google_requests.Request()
                idinfo = google_id_token.verify_oauth2_token(id_token, request)

                if not idinfo.get("email"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token"
                    )

                return idinfo

        except ImportError:
            # Fallback to manual JWT verification using PyJWT
            logger.warning("google-auth not installed, using fallback verification")

            # Fetch Google's public keys
            certs = await get_google_public_keys()

            # Decode header to get key ID
            unverified_header = jwt.get_unverified_header(id_token)
            kid = unverified_header.get("kid")

            if not kid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            # Find the matching key
            key = None
            for cert_key in certs.get("keys", []):
                if cert_key.get("kid") == kid:
                    key = cert_key
                    break

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            # Build the public key
            from jwt.algorithms import RSAAlgorithm
            public_key = RSAAlgorithm.from_jwk(key)

            # Verify and decode the token
            configured_ids = [cid for cid in GOOGLE_CLIENT_IDS if cid]
            audience = configured_ids[0] if configured_ids else None

            try:
                token_info = jwt.decode(
                    id_token,
                    public_key,
                    algorithms=["RS256"],
                    audience=audience,
                    issuer=["https://accounts.google.com", "accounts.google.com"]
                )
            except jwt.InvalidAudienceError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            except jwt.InvalidIssuerError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            # Verify email is present
            if not token_info.get("email"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            return token_info

    except HTTPException:
        raise
    except Exception as e:
        # SECURITY: Don't expose internal error details
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def create_app_jwt(user_email: str) -> tuple[str, int]:
    """
    Create a JWT token for the mobile app.

    Token includes:
    - sub: User email (subject)
    - exp: Expiration timestamp
    - iat: Issued at timestamp
    - jti: Unique token ID (for future revocation support)
    - type: Token type identifier
    """
    expires_in = JWT_EXPIRATION_DAYS * 24 * 60 * 60  # seconds
    expiration = datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS)

    # Generate unique token ID for future revocation support
    token_id = str(uuid.uuid4())

    payload = {
        "sub": user_email,
        "exp": expiration,
        "iat": datetime.utcnow(),
        "jti": token_id,  # JWT ID for revocation support
        "type": "mobile_access",
        "ver": 2,  # Token version - increment when token format changes
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires_in


# ============== Mobile Auth Endpoints ==============

@router.post("/mobile/google", response_model=MobileAuthResponse)
@limiter.limit("10/minute")  # Rate limit: 10 auth attempts per minute per IP
async def mobile_google_auth(
    request: Request,
    auth_request: MobileGoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """
    Exchange Google ID token for app JWT (mobile authentication).

    Flow:
    1. Mobile app gets Google ID token via Google Sign-In
    2. Mobile app sends token to this endpoint
    3. We verify token with Google
    4. We create/find user in database
    5. We return JWT for subsequent API calls
    """
    # Verify Google token
    google_user = await verify_google_token(auth_request.id_token)

    email = google_user.get("email")
    name = google_user.get("name", google_user.get("given_name", ""))

    # Find or create user
    db_user = db.query(User).filter(User.email == email).first()

    if not db_user:
        db_user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            email_verified=datetime.utcnow()
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    elif name and db_user.name != name:
        db_user.name = name
        db.commit()
        db.refresh(db_user)

    # Create app JWT
    access_token, expires_in = create_app_jwt(email)

    return MobileAuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserResponse.model_validate(db_user)
    )


@router.get("/mobile/me", response_model=UserResponse)
async def get_mobile_current_user(
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db)
):
    """
    Get current user info from JWT token.
    Used by mobile app to verify token and get user details.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )

    token = authorization[7:]

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("sub")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        db_user = db.query(User).filter(User.email == email).first()

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return db_user

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


# ============== Existing Auth Endpoints ==============

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
async def get_user(
    user_id: str,
    authorization: str = Header(None, alias="Authorization"),
    x_internal_secret: str = Header(None, alias="X-Internal-Secret"),
    db: Session = Depends(get_db)
):
    """
    Get user by ID.
    SECURITY: Requires either valid Bearer token or X-Internal-Secret header.
    This endpoint is used by NextAuth for session verification.
    """
    from ..dependencies import INTERNAL_SERVICE_SECRET, JWT_SECRET, JWT_ALGORITHM

    # Verify caller is authorized (either internal service or authenticated user)
    is_authorized = False

    # Check for internal service secret (NextAuth server-side calls)
    if x_internal_secret and INTERNAL_SERVICE_SECRET:
        if x_internal_secret == INTERNAL_SERVICE_SECRET:
            is_authorized = True

    # Check for valid Bearer token
    if not is_authorized and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            is_authorized = True
        except jwt.InvalidTokenError:
            pass

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

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