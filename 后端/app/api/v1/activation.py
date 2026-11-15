"""Payment activation + account claim endpoints for the web-pay cashier.

web-pay (energy-iq.app cashier) 收款成功后回调 /activation/activate 在
真实用户库建号/升级；买家在 /success 页通过 web-pay 的 /v1/claim
（Stripe 验证后）换取 30 分钟设密码 token，再调 /activation/set-password
完成账号接管并直接获得登录态。

安全模型:
- activate/claim 仅接受共享密钥 (X-Activation-Token, secrets.compare_digest),
  密钥配置于 /app/.env 的 ACTIVATION_TOKEN (与 web-pay 容器
  DATA_DIR/activation_token 文件保持一致)。
- set-password 走标准 Bearer access-token 鉴权 (claim 签发的短时效 token)。
- 无医疗/敏感数据; email 规范化小写。
"""
from __future__ import annotations

import os
import secrets
import uuid
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.user import User

router = APIRouter(prefix="/activation")

def _load_activation_token() -> str:
    """Env var first; fall back to /app/.env for deployments without load_dotenv."""
    tok = os.environ.get("ACTIVATION_TOKEN", "").strip()
    if tok:
        return tok
    try:
        for line in Path("/app/.env").read_text().splitlines():
            if line.startswith("ACTIVATION_TOKEN="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""


ACTIVATION_TOKEN = _load_activation_token()

# web-pay plan id -> 后端订阅档 (2026-10-31: starter 成为真实 $9 档)
_PLAN_MAP = {
    "starter": "starter",
    "professional": "pro",
    "team": "enterprise",
    "enterprise": "enterprise",
}


def _authorize(x_activation_token: str) -> None:
    if not ACTIVATION_TOKEN or not secrets.compare_digest(
        x_activation_token or "", ACTIVATION_TOKEN
    ):
        raise HTTPException(status_code=401, detail="unauthorized")


class ActivationRequest(BaseModel):
    email: str
    plan: str
    cycle: str = "month"
    stripe_customer_id: str | None = None
    order_ref: str | None = None  # session/invoice id, 仅日志


@router.post("/activate")
async def activate(
    req: ActivationRequest,
    x_activation_token: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    _authorize(x_activation_token)
    email = (req.email or "").strip().lower()
    local, _, domain = email.partition("@")
    if not local or "." not in (domain or ""):
        raise HTTPException(status_code=400, detail="Invalid email")

    target_plan = _PLAN_MAP.get((req.plan or "").strip().lower())
    if not target_plan:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {req.plan}")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    created = user is None
    if user is None:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=local[:32] or "Member",
            password_hash=hash_password(secrets.token_urlsafe(18)),
            market="global",
            subscription_plan=target_plan,
        )
        db.add(user)
    else:
        user.subscription_plan = target_plan
    if req.stripe_customer_id:
        user.stripe_customer_id = req.stripe_customer_id
    await db.commit()
    return {
        "status": "activated",
        "email": email,
        "plan": target_plan,
        "created": created,
        "order_ref": req.order_ref,
    }


class ClaimRequest(BaseModel):
    session_id: str = Field(min_length=8, max_length=128)
    email: str


@router.post("/claim")
async def claim(
    req: ClaimRequest,
    x_activation_token: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """web-pay 验证 Stripe session 已支付后, 为买家换取设密码 token。"""
    _authorize(x_activation_token)
    email = (req.email or "").strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        # webhook 未到/激活未完成 —— 前端应稍后重试
        raise HTTPException(status_code=404, detail="activation pending")
    token = create_access_token(subject=str(user.id), expires_delta=timedelta(minutes=30))
    return {
        "email": email,
        "plan": user.subscription_plan,
        "set_password_token": token,
    }


class SetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


@router.post("/set-password")
async def set_password(
    req: SetPasswordRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """买家自助设密码 (claim token 鉴权), 完成后直接签发登录态。"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(req.password)
    await db.commit()
    return {
        "access_token": create_access_token(subject=str(user.id)),
        "refresh_token": create_refresh_token(subject=str(user.id)),
        "email": user.email,
        "plan": user.subscription_plan,
    }
