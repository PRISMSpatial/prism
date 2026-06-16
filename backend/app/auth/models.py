"""Auth Pydantic models."""
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role: str = "viewer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserPublic"


class UserPublic(BaseModel):
    id: str
    email: str
    display_name: str
    initials: str
    role: str


class UserRecord(BaseModel):
    id: str
    email: str
    display_name: str
    initials: str
    role: str
    hashed_password: str


TokenResponse.model_rebuild()
