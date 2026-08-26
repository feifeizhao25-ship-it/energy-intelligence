from types import SimpleNamespace

import pytest

from app.config import settings
from app.services.stripe_service import StripeService


def test_checkout_rejects_unknown_plan():
    with pytest.raises(ValueError, match="Unsupported subscription plan"):
        StripeService.create_checkout_session("user-1", "free")


def test_checkout_propagates_identity_to_subscription(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_pro")
    monkeypatch.setattr(settings, "STRIPE_SUCCESS_URL", "https://app.example/success")
    monkeypatch.setattr(settings, "STRIPE_CANCEL_URL", "https://app.example/cancel")
    captured = {}

    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(url="https://checkout.example/session")

    monkeypatch.setattr("stripe.checkout.Session.create", create)
    url = StripeService.create_checkout_session("user-1", "pro")
    assert url == "https://checkout.example/session"
    assert captured["metadata"] == {"user_id": "user-1", "plan": "pro"}
    assert captured["subscription_data"]["metadata"] == captured["metadata"]
