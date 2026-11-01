"""International (market=global) views of the commercial catalogue.

The registry in data/entitlements.json is the single source of truth and already carries ``name_en`` /
``description_en`` / ``features_en``. The international view uses only those fields and never shows CNY, Alipay
or Chinese text. The international currency is USD (owner decision 2026-11-01). USD prices are never invented: an amount appears
only when it was read from the configured Stripe Price object AND that Price is in USD; otherwise the amount is null
and the note says it is shown at checkout.
"""
from __future__ import annotations

import copy
import re
import time
from typing import Any, Dict, Optional

PRODUCT_NAME_EN = "Energy Intelligence"
# The one currency of the international edition. A Stripe Price in any other currency is never shown or sold.
INTERNATIONAL_CURRENCY = "USD"
_CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]")

GLOBAL_PRICING_NOTE = (
    "Annual billing is the only billing period. All international prices are in US dollars (USD) and are shown "
    "on the secure checkout page before you pay. Plans without a listed amount are arranged with sales."
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
    "currency": "International prices are in US dollars (USD) and are shown at checkout. No CNY pricing applies to international accounts.",
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
    if real and str(real.get("currency") or "").upper() != INTERNATIONAL_CURRENCY:
        real = None  # a non-USD Stripe Price is a misconfiguration for the international edition: never display it
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
        "note": "Shown at checkout (USD)." if plan_id in ("pro", "enterprise") else "Contact sales.",
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


# ---------------------------------------------------------------------------
# Error messages for the international edition
# ---------------------------------------------------------------------------
# Billing / AI / validation errors were raised with Chinese ``detail`` text for everybody, so an international
# user who hit "user not found" or "use Stripe" got Chinese. Known messages have an exact English counterpart;
# anything else that still contains Chinese falls back to a generic English line chosen by status code, so the
# international API can never answer a request with Chinese error text.
ERROR_MESSAGES_EN: Dict[str, str] = {
    "用户不存在": "User not found.",
    "订单用户不存在": "The user of this order was not found.",
    "请提供已支付订单号": "Provide the number of a paid order.",
    "找不到这笔订单": "Order not found.",
    "这笔订单还不能自动测算退款，请财务按支付渠道记录人工核对": "This order cannot be refund-estimated automatically. Finance will check it manually against the payment channel records.",
    "国内版请使用国内支付渠道": "Domestic payment channels are for the domestic edition. International accounts pay with Stripe.",
    "国际版用户请使用 Stripe 支付": "International accounts pay with Stripe.",
    "国内版请在国内会员中心管理订单": "Orders of the domestic edition are managed in the domestic membership centre.",
    "尚无账单客户记录，请先完成支付再打开账单管理": "There is no billing customer record yet. Complete a payment before opening billing management.",
    "订阅套餐信息无效": "The subscription plan information is invalid.",
    "支付订单不存在": "Payment order not found.",
    "没有可开票的已支付订单": "There is no paid order to invoice.",
    "请填写发票抬头": "Enter an invoice title.",
    "请求参数无效": "Invalid request parameters.",
    "AI 服务暂时不可用，请稍后重试": "The AI service is temporarily unavailable. Please try again later.",
    "金额须为大于0、最多两位小数的有限数值": "The amount must be a number greater than 0 with at most two decimal places.",
    "免费版无需续费": "The free plan does not need renewal.",
    "档位无效": "Invalid plan.",
    "降级目标必须低于当前档位 (升级请走购买/续费)": "The downgrade target must be below the current plan. Upgrades go through purchase or renewal.",
    "周期无效": "Invalid billing period.",
}

_GENERIC_ERROR_EN = {
    400: "The request could not be completed.",
    401: "Please sign in again.",
    403: "You are not allowed to do this.",
    404: "Not found.",
    409: "This conflicts with the current state of the account.",
    422: "Invalid request parameters.",
    429: "Too many requests. Please try again later.",
}


def localize_error_text(text: Any, status_code: int = 400) -> Any:
    """English error text for international callers. Text without Chinese is returned unchanged."""
    if not isinstance(text, str) or not _CJK.search(text):
        return text
    known = ERROR_MESSAGES_EN.get(text.strip())
    if known:
        return known
    if status_code >= 500:
        return "The service is temporarily unavailable. Please try again later."
    return _GENERIC_ERROR_EN.get(status_code, "The request could not be completed.")


def localize_error_detail(detail: Any, status_code: int = 400) -> Any:
    """Same for FastAPI ``detail`` values: a string, or a dict / list carrying ``message`` / ``msg`` strings."""
    if isinstance(detail, str):
        return localize_error_text(detail, status_code)
    if isinstance(detail, dict):
        return {k: (localize_error_text(v, status_code) if k in ("message", "msg", "detail", "error_description") else v)
                for k, v in detail.items()}
    return detail
