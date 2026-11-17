import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

bearer = HTTPBearer(auto_error=False)

_DEV_JWT_SECRET = "development-secret-change-before-deploy"


def _ensure_production_jwt_secret() -> None:
    if os.getenv("ENV") == "production" and os.getenv("JWT_SECRET", _DEV_JWT_SECRET) == _DEV_JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set to a non-default value when ENV=production.")


_ensure_production_jwt_secret()


def has_admin_access(user: User) -> bool:
    return user.role in {"admin", "developer"}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"{salt.hex()}:{key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":", 1)
        candidate = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1
        )
        return hmac.compare_digest(candidate.hex(), key_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(user: User) -> str:
    header = _encode({"alg": "HS256", "typ": "JWT"})
    payload = _encode(
        {
            "sub": str(user.id),
            "role": user.role,
            "exp": int(time.time()) + int(os.getenv("ACCESS_TOKEN_MINUTES", "1440")) * 60,
        }
    )
    signing_input = f"{header}.{payload}".encode()
    secret = os.getenv("JWT_SECRET", _DEV_JWT_SECRET).encode()
    signature = base64.urlsafe_b64encode(
        hmac.new(secret, signing_input, hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{header}.{payload}.{signature}"


def _encode(value: dict) -> str:
    return base64.urlsafe_b64encode(
        json.dumps(value, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()


def _decode(token: str) -> dict:
    header, payload, signature = token.split(".")
    secret = os.getenv("JWT_SECRET", "development-secret-change-before-deploy").encode()
    expected = base64.urlsafe_b64encode(
        hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid signature")
    data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    if data["exp"] <= int(time.time()):
        raise ValueError("Expired token")
    return data


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")
    try:
        payload = _decode(credentials.credentials)
        user = db.get(User, int(payload["sub"]))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        user = None
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session is invalid. Please sign in again.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not has_admin_access(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access is required.")
    return user


def require_developer(user: User = Depends(get_current_user)) -> User:
    if user.role != "developer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Developer access is required.")
    return user
