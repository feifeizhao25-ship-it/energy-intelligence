"""杂项基础端点：/me、/settings、/billing/plans。"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user_id
from app.core.market import request_market
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
    from app.services.current_entitlement import current_entitlement, name_for_market

    entitlement = current_entitlement(user)
    return success(data={
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "role": user.role,
        "market": user.market or "cn",
        "subscription_plan": entitlement["plan_id"],
        "plan_name": name_for_market(entitlement, user.market),
        "expires_at": entitlement["expires_at"],
        "quotas": {
            "ai_queries_per_day": entitlement["quotas"].get("ai_queries_per_day"),
            "report_exports_per_month": entitlement["quotas"].get("report_exports_per_month"),
            "max_projects": entitlement["quotas"].get("max_projects"),
        },
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


# 对外仍是这五档。名称和年费分只读权益注册表，不再另写一套叫法。
_PUBLIC_PLAN_IDS = ("free", "pro", "full", "team", "enterprise")


def _build_plans():
    """计划列表的名称、年费和额度都从权益注册表来。"""
    from app.services.entitlements_registry import load_registry

    tiers = load_registry()["tiers"]
    plans = []
    for plan_id in _PUBLIC_PLAN_IDS:
        tier = tiers[plan_id]
        entitlements = {
            key: list(value) if isinstance(value, list) else value
            for key, value in ENTITLEMENTS[plan_id].items()
        }
        yearly = int((tier.get("price") or {}).get("yearly_cny") or 0)
        plans.append({
            "id": plan_id,
            "name": tier.get("name") or plan_id,
            "price_cents": yearly * 100,
            "currency": "CNY",
            "report_exports_per_month": entitlements["report_exports_per_month"],
            "ai_queries_per_day": entitlements["ai_queries_per_day"],
            "entitlements": entitlements,
        })
    return plans


@router.get("/billing/plans")
async def list_billing_plans(request: Request):
    """公开端点：订阅计划列表（货币一律用整数 cents）。global 市场：英文名、不出现 CNY，金额只来自 Stripe。"""
    plans = _build_plans()
    if request_market(request) == "global":
        from app.services.entitlements_registry import load_registry
        from app.services.market_localization import localize_plans

        plans = localize_plans(plans, load_registry())
    return success(data={"plans": plans})
