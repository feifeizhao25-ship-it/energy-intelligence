from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token_payload
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="登录已失效，请重新登录",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_id(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> str:
    """校验签名、类型，并核对用户仍存在且 token_version 未变（注销/改密后旧令牌立即失效）。"""
    payload = decode_token_payload(token)
    if not payload:
        raise _unauthorized()
    user_id = payload["sub"]
    current = await db.scalar(select(User.token_version).where(User.id == user_id))
    if current is None or int(payload.get("tv", 0) or 0) != int(current or 0):
        raise _unauthorized()
    return user_id
