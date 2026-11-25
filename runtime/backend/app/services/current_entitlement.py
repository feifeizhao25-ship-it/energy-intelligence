"""当前用户的有效权益。档位、额度、到期日只从这里读。

名称和额度来自 data/entitlements.json。价格不在这里决定。
过期后的有效档位与 User.plan 相同，回到 free。
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.subscription import PLAN_QUOTAS
from app.services.entitlements_registry import load_registry


def current_entitlement(user: Any) -> dict:
    plan_id = getattr(user, "plan", None) or "free"
    tiers = load_registry().get("tiers") or {}
    if plan_id not in tiers or plan_id not in PLAN_QUOTAS:
        plan_id = "free"
    tier = tiers.get(plan_id) or {}
    quotas = {
        key: (list(value) if isinstance(value, list) else value)
        for key, value in PLAN_QUOTAS.get(plan_id, {}).items()
    }
    expires = getattr(user, "subscription_expires_at", None)
    if isinstance(expires, datetime) and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return {
        "plan_id": plan_id,
        "name_zh": tier.get("name") or plan_id,
        "name_en": tier.get("name_en") or plan_id,
        "quotas": quotas,
        "expires_at": expires.isoformat() if isinstance(expires, datetime) else None,
    }


def name_for_market(entitlement: dict, market: str | None) -> str:
    if (market or "cn") == "global":
        return entitlement["name_en"]
    return entitlement["name_zh"]
