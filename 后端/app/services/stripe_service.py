"""
Stripe payment integration service.

stripe 为可选依赖：库未安装或未配置 STRIPE_SECRET_KEY 时，
本模块可正常 import，调用方通过 stripe_configured() 判断可用性，
不可用时由 API 层返回 503（而非 import 崩溃或 500）。
"""

from typing import Optional

from app.config import settings


class StripeNotConfigured(RuntimeError):
    """stripe 库缺失或密钥未配置。"""


def _import_stripe():
    """惰性导入 stripe；未安装时返回 None。"""
    try:
        import stripe
    except ImportError:
        return None
    return stripe


def stripe_configured() -> bool:
    """stripe 库可用且已配置密钥。"""
    return _import_stripe() is not None and bool(settings.STRIPE_SECRET_KEY)


def _require_stripe():
    stripe = _import_stripe()
    if stripe is None:
        raise StripeNotConfigured("stripe library is not installed")
    if not settings.STRIPE_SECRET_KEY:
        raise StripeNotConfigured("STRIPE_SECRET_KEY is not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


class StripeService:
    @staticmethod
    def create_checkout_session(user_id: str, plan: str, customer_id: Optional[str] = None) -> str:
        """Create Stripe checkout session for subscription.
        If customer_id is provided, link it. Otherwise a new customer is created on checkout completion.
        """
        stripe = _require_stripe()
        price_id = (
            settings.STRIPE_PRO_PRICE_ID if plan == "pro"
            else settings.STRIPE_ENTERPRISE_PRICE_ID
            if plan == "enterprise"
            else settings.STRIPE_PRO_PRICE_ID
        )
        kwargs = {
            "payment_method_types": ["card"],
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            # config.py 未定义回调 URL 配置项，用 getattr 兜底避免 AttributeError
            "success_url": getattr(settings, "STRIPE_SUCCESS_URL", None)
            or "https://localhost/billing/success",
            "cancel_url": getattr(settings, "STRIPE_CANCEL_URL", None)
            or "https://localhost/billing/cancel",
            "metadata": {"user_id": user_id, "plan": plan},
        }
        if customer_id:
            kwargs["customer"] = customer_id

        session = stripe.checkout.Session.create(**kwargs)
        return session.url

    @staticmethod
    def create_billing_portal_session(customer_id: str) -> str:
        """Create Stripe billing portal session."""
        stripe = _require_stripe()
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=getattr(settings, "STRIPE_PORTAL_RETURN_URL", None)
            or "https://localhost/billing",
        )
        return session.url

    @staticmethod
    def verify_webhook(payload: bytes, sig: str) -> dict:
        """Verify and parse Stripe webhook; 验签失败抛 ValueError（API 层映射 400）。"""
        stripe = _require_stripe()
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
            return event
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            raise ValueError(f"Webhook verification failed: {str(e)}")


stripe_service = StripeService()
