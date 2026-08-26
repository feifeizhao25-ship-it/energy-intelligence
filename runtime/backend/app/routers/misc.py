"""杂项基础端点：/me、/settings、/billing/plans。"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_id
from app.core.subscription import ENTITLEMENTS
from app.database import get_db
from app.models.user import User
from app.utils.response import success

router = APIRouter()


@router.get("/me")
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return success(data={"id": user_id, "market": "cn"})
    return success(data={
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role,
        "market": user.market or "cn",
        "subscription_plan": user.subscription_plan or "free",
    })


@router.get("/settings")
async def get_settings(
    user_id: str = Depends(get_current_user_id),
):
    return success(data={
        "algorithm_registration_no": None,
        "language": "zh-CN",
        "notifications_enabled": True,
    })


_PLAN_META = {
    "free": {"name": "免费版", "price_cents": 0},
    "pro": {"name": "专业版", "price_cents": 19900},
    "enterprise": {"name": "企业版", "price_cents": None},
}


def _build_plans():
    """从 ENTITLEMENTS 单一事实源生成计划列表（列表值拷贝，避免外部改矩阵）。"""
    plans = []
    for plan_id, meta in _PLAN_META.items():
        entitlements = {
            key: list(value) if isinstance(value, list) else value
            for key, value in ENTITLEMENTS[plan_id].items()
        }
        plans.append({
            "id": plan_id,
            "name": meta["name"],
            "price_cents": meta["price_cents"],
            "currency": "CNY",
            "report_exports_per_month": entitlements["report_exports_per_month"],
            "ai_queries_per_day": entitlements["ai_queries_per_day"],
            "entitlements": entitlements,
        })
    return plans


@router.get("/billing/plans")
async def list_billing_plans():
    """公开端点：订阅计划列表（货币一律用整数 cents）。"""
    return success(data={"plans": _build_plans()})
