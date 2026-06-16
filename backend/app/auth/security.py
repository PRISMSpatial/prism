"""JWT + password utilities and FastAPI dependency."""
import hashlib
import hmac
import secrets
import time
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.auth.models import UserPublic, UserRecord
from app.auth.store import user_store
from app.config import settings

security_scheme = HTTPBearer(auto_error=False)

# ── password hashing (PBKDF2-SHA256, no extra deps) ──────────────────────

_ITERATIONS = 260_000
_SALT_LEN = 16


def hash_password(password: str) -> str:
    salt = secrets.token_hex(_SALT_LEN)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS)
    return f"{_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    parts = hashed.split("$")
    if len(parts) == 3:
        iterations, salt, dk_hex = int(parts[0]), parts[1], parts[2]
    else:
        salt, dk_hex = parts[0], parts[1]
        iterations = _ITERATIONS
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iterations)
    return hmac.compare_digest(dk.hex(), dk_hex)


# ── JWT (compact hand-rolled HS256, no jose dependency) ──────────────────

import base64
import json


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _sign(payload: bytes, secret: str) -> str:
    return _b64url(hmac.new(secret.encode(), payload, hashlib.sha256).digest())


def create_access_token(user_id: str) -> tuple[str, int]:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    exp = int(time.time()) + settings.JWT_EXPIRE_SECONDS
    payload = _b64url(json.dumps({"sub": user_id, "exp": exp}).encode())
    sig = _sign(f"{header}.{payload}".encode(), settings.JWT_SECRET)
    return f"{header}.{payload}.{sig}", settings.JWT_EXPIRE_SECONDS


def decode_token(token: str) -> dict | None:
    try:
        header_b64, payload_b64, sig = token.split(".")
        expected = _sign(f"{header_b64}.{payload_b64}".encode(), settings.JWT_SECRET)
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── FastAPI dependencies ─────────────────────────────────────────────────

async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)],
) -> UserPublic:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authorization header")
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = user_store.get_by_id(payload["sub"])
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        initials=user.initials,
        role=user.role,
    )


async def get_optional_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)],
) -> UserPublic | None:
    if not creds:
        return None
    payload = decode_token(creds.credentials)
    if not payload:
        return None
    user = user_store.get_by_id(payload["sub"])
    if not user:
        return None
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        initials=user.initials,
        role=user.role,
    )


CurrentUser = Annotated[UserPublic, Depends(get_current_user)]
OptionalUser = Annotated[UserPublic | None, Depends(get_optional_user)]


async def require_auth_unless_demo(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security_scheme)],
) -> UserPublic | None:
    if settings.DEMO_MODE:
        if not creds:
            return None
        return await get_optional_user(creds)
    return await get_current_user(creds)


ProtectedUser = Annotated[UserPublic | None, Depends(require_auth_unless_demo)]
