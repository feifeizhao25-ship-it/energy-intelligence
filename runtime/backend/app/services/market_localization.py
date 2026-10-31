"""International (market=global) views of the commercial catalogue.

The registry in data/entitlements.json is the single source of truth and already carries ``name_en`` /
``description_en`` / ``features_en``. The international view uses only those fields and never shows CNY, Alipay
or Chinese text. USD (or any other currency) prices are never invented: an amount appears only when it was read
from the configured Stripe Price object; otherwise the amount is null and the note says it is shown at checkout.
"""
from __future__ import annotations

import copy
import re
import time
from typing import Any, Dict, Optional

PRODUCT_NAME_EN = "Energy Intelligence"
_CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]")

GLOBAL_PRICING_NOTE = (
    "Annual billing is the only billing period. The amount and currency are shown on the secure checkout page "
    "before you pay. Plans without a listed amount are arranged with sales."
)

GLOBAL_BILLING_RULES = {
    "billing_period": "yearly",
    "renewal": (
        "Plans renew yearly. Renewing before expiry extends the term by one year from the current expiry date; "
        "renewing after expiry starts a new year on the payment date."
    ),
    "downgrade": (
        "A downgrade takes effect at the end of the current term. Benefits stay the same until then and the "
        "price difference is not refunded."
    ),
    "refund": "International refund terms are not published through this endpoint; the terms shown at checkout apply.",
    "currency": "Amounts and currency are shown at checkout. No CNY pricing applies to international accounts.",
}

_PRICE_CACHE: Dict[str, Any] = {}
_PRICE_TTL_SECONDS = 600


def contains_cjk(value: Any) -> bool:
    if isinstance(value, str):
        return bool(_CJK.search(value))
    if isinstance(value, dict):
        return any(contains_cjk(k) or contains_cjk(v) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return any(contains_cjk(v) for v in value)
    return False


def international_price(plan_id: str) -> Optional[Dict[str, Any]]:
    """Real recurring price from Stripe for this plan, or None. Cached; any failure returns None (never a guess)."""
    now = time.time()
    hit = _PRICE_CACHE.get(plan_id)
    if hit and now - hit[0] < _PRICE_TTL_SECONDS:
        return hit[1]
    price: Optional[Dict[str, Any]] = None
    try:
        from app.services.stripe_service import StripeService

        price = StripeService.get_price(plan_id)
    except Exception:
        price = None
    _PRICE_CACHE[plan_id] = (now, price)
    return price


def clear_price_cache() -> None:
    _PRICE_CACHE.clear()


def _price_block(plan_id: str) -> Dict[str, Any]:
    if plan_id == "free":
        return {"amount_cents": 0, "currency": None, "interval": "year", "source": "free", "note": None}
    real = international_price(plan_id)
    if real:
        return {
            "amount_cents": real["amount_cents"],
            "currency": real["currency"].upper(),
            "interval": real.get("interval") or "year",
            "source": "stripe",
            "note": None,
        }
    return {
        "amount_cents": None,
        "currency": None,
        "interval": "year",
        "source": None,
        "note": "Shown at checkout." if plan_id in ("pro", "enterprise") else "Contact sales.",
    }


def localize_registry(registry: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(registry)
    out["product"] = PRODUCT_NAME_EN
    out["pricing_note"] = GLOBAL_PRICING_NOTE
    tiers = out.get("tiers") or {}
    for tier_id, tier in tiers.items():
        tier["name"] = tier.pop("name_en", None) or tier_id.title()
        tier["description"] = tier.pop("description_en", None) or ""
        features = tier.pop("features_en", None)
        tier.pop("features_zh", None)
        tier["features"] = list(features or [])
        tier["price"] = _price_block(tier_id)
    return out


def localize_plans(plans: list, registry: Dict[str, Any]) -> list:
    tiers = (registry or {}).get("tiers") or {}
    out = []
    for plan in plans:
        pid = plan["id"]
        price = _price_block(pid)
        item = dict(plan)
        item["name"] = (tiers.get(pid) or {}).get("name_en") or pid.title()
        item["price_cents"] = price["amount_cents"]
        item["currency"] = price["currency"]
        item["price"] = price
        out.append(item)
    return out
