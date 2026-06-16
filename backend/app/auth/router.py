"""Auth endpoints — register, login, me, refresh."""
import uuid

from fastapi import APIRouter, HTTPException, status

from app.auth.models import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
    UserRecord,
)
from app.auth.security import (
    CurrentUser,
    create_access_token,
    hash_password,
    verify_password,
)
from app.auth.store import user_store

router = APIRouter(prefix="/auth", tags=["auth"])

VALID_ROLES = {"viewer", "analyst", "admin"}


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest):
    if user_store.get_by_email(req.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if req.role not in VALID_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Role must be one of {VALID_ROLES}")
    if len(req.password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 8 characters")
    if not req.display_name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Display name required")

    parts = req.display_name.strip().split()
    initials = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else parts[0][1:2])).upper()

    user = UserRecord(
        id=str(uuid.uuid4()),
        email=req.email.lower(),
        display_name=req.display_name.strip(),
        initials=initials,
        role=req.role,
        hashed_password=hash_password(req.password),
    )
    user_store.add(user)
    token, expires = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires,
        user=UserPublic(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            initials=user.initials,
            role=user.role,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = user_store.get_by_email(req.email)
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    token, expires = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires,
        user=UserPublic(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            initials=user.initials,
            role=user.role,
        ),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser):
    return user


@router.post("/refresh", response_model=TokenResponse)
async def refresh(user: CurrentUser):
    token, expires = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        expires_in=expires,
        user=user,
    )
