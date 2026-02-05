from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime

class AccountBase(BaseModel):
    type: str
    provider: str
    provider_account_id: str
    refresh_token: Optional[str] = None
    access_token: Optional[str] = None
    expires_at: Optional[int] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    id_token: Optional[str] = None
    session_state: Optional[str] = None

class AccountCreate(AccountBase):
    user_id: str

class AccountResponse(AccountBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    session_token: str
    expires: datetime

class SessionCreate(SessionBase):
    user_id: str

class SessionResponse(SessionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class VerificationTokenCreate(BaseModel):
    identifier: str
    token: str
    expires: datetime

class VerificationTokenResponse(BaseModel):
    identifier: str
    token: str
    expires: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class UserAuth(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    image: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    is_first_login: bool = False
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class OAuthProvider(BaseModel):
    id: str
    name: str
    type: str
    client_id: str
    client_secret: str
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    scope: Optional[str] = None 