"""开发/测试构建里的登录通道。正式环境不挂载；挂载了也会再检查一次开关。"""

from __future__ import annotations

import os
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.services.dev_login_gate import is_test_login_enabled
from app.utils.response import success

router = APIRouter()


class TestLoginBody(BaseModel):
    market: str = Field(default="global", max_length=16)
    name: str = Field(default="", max_length=40)


def _gate_open() -> bool:
    return is_test_login_enabled(settings.ENVIRONMENT, os.getenv("TEST_LOGIN_ENABLED"))


@router.post("/auth/test-login")
async def issue_dev_login(body: TestLoginBody, db: AsyncSession = Depends(get_db)):
    if not _gate_open():
        raise HTTPException(status_code=404, detail="Not found.")
    market = "cn" if (body.market or "").strip().lower() == "cn" else "global"
    email = "test-login-cn@example.invalid" if market == "cn" else "test-login-global@example.invalid"
    name = body.name.strip() or ("测试用户" if market == "cn" else "Test User")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            market=market,
            role="user",
            subscription_plan="free",
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    token = create_access_token(subject=user.id, token_version=int(user.token_version or 0))
    return success(data={"access_token": token, "token_type": "bearer", "name": user.name, "email": user.email})
