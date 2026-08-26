"""
Stripe payment integration service.
"""

import stripe
from typing import Optional

from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    @staticmethod
    def create_checkout_session(user_id: str, plan: str, customer_id: Optional[str] = None) -> str:
        """Create Stripe checkout session for subscription.
        If customer_id is provided, link it. Otherwise a new customer is created on checkout completion.
        """
        prices = {"pro": settings.STRIPE_PRO_PRICE_ID, "enterprise": settings.STRIPE_ENTERPRISE_PRICE_ID}
        if plan not in prices:
            raise ValueError("Unsupported subscription plan")
        price_id = prices[plan]
        if not price_id:
            raise RuntimeError(f"Stripe price is not configured for plan: {plan}")
        if not settings.STRIPE_SUCCESS_URL or not settings.STRIPE_CANCEL_URL:
            raise RuntimeError("Stripe checkout return URLs are not configured")
        kwargs = {
            "payment_method_types": ["card"],
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": settings.STRIPE_SUCCESS_URL,
            "cancel_url": settings.STRIPE_CANCEL_URL,
            "metadata": {"user_id": user_id, "plan": plan},
            "subscription_data": {"metadata": {"user_id": user_id, "plan": plan}},
        }
        if customer_id:
            kwargs["customer"] = customer_id

        session = stripe.checkout.Session.create(**kwargs)
        return session.url

    @staticmethod
    def create_billing_portal_session(customer_id: str) -> str:
        """Create Stripe billing portal session."""
        if not settings.STRIPE_PORTAL_RETURN_URL:
            raise RuntimeError("Stripe portal return URL is not configured")
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=settings.STRIPE_PORTAL_RETURN_URL,
        )
        return session.url

    @staticmethod
    def verify_webhook(payload: bytes, sig: str) -> dict:
        """Verify and parse Stripe webhook."""
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
            return event
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            raise ValueError(f"Webhook verification failed: {str(e)}")


stripe_service = StripeService()
