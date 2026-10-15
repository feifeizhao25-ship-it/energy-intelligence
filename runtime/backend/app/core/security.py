from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _jwt_key_and_algorithm() -> tuple:
    """优先使用配置的 RS256 密钥对；未配置时退回 HS256 + SECRET_KEY。"""
    if settings.JWT_PRIVATE_KEY:
        return settings.JWT_PRIVATE_KEY, settings.JWT_ALGORITHM
    return settings.SECRET_KEY, "HS256"


def _jwt_verify_key_and_algorithm() -> tuple:
    if settings.JWT_PUBLIC_KEY:
        return settings.JWT_PUBLIC_KEY, settings.JWT_ALGORITHM
    return settings.SECRET_KEY, "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str, expires_delta: Optional[timedelta] = None, token_version: int = 0
) -> str:
    """``tv`` = 用户的 token_version；注销账号、重置密码时递增，旧令牌立即失效。"""
    key, algorithm = _jwt_key_and_algorithm()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "access", "tv": int(token_version or 0)},
        key,
        algorithm=algorithm,
    )


def create_refresh_token(subject: str, token_version: int = 0) -> str:
    key, algorithm = _jwt_key_and_algorithm()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh", "tv": int(token_version or 0)},
        key,
        algorithm=algorithm,
    )


def decode_token_payload(token: str, expected_type: str = "access") -> Optional[dict]:
    """Like :func:`decode_token` but returns the full payload (incl. ``tv``)."""
    key, algorithm = _jwt_verify_key_and_algorithm()
    try:
        payload = jwt.decode(
            token, key, algorithms=[algorithm], options={"require": ["exp", "sub"]}
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload


def decode_token(token: str, expected_type: str = "access") -> Optional[str]:
    """Decode a JWT and return its subject only if its ``type`` claim matches.

    Defaults to ``access`` so a long-lived refresh token (or a token without a
    type claim) can never be used as a bearer access token.
    """
    key, algorithm = _jwt_verify_key_and_algorithm()
    try:
        payload = jwt.decode(
            token, key, algorithms=[algorithm], options={"require": ["exp", "sub"]}
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    return payload.get("sub")
