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


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    key, algorithm = _jwt_key_and_algorithm()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "access"},
        key,
        algorithm=algorithm,
    )


def create_refresh_token(subject: str) -> str:
    key, algorithm = _jwt_key_and_algorithm()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        key,
        algorithm=algorithm,
    )


def decode_token(token: str) -> Optional[str]:
    key, algorithm = _jwt_verify_key_and_algorithm()
    try:
        payload = jwt.decode(token, key, algorithms=[algorithm])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
