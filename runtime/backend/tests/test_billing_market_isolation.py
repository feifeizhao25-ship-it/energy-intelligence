from unittest.mock import Mock

import pytest
from sqlalchemy import select

from app.models.user import User
from app.services.stripe_service import stripe_service


@pytest.mark.asyncio
async def test_domestic_account_never_calls_stripe(client, auth_headers, db_session, monkeypatch):
    user = (await db_session.execute(select(User))).scalar_one()
    user.stripe_customer_id = "cus_legacy"
    await db_session.commit()
    calls = []
    def forbidden(*args, **kwargs):
        calls.append((args, kwargs))
        raise AssertionError("Domestic account must not call Stripe")
    monkeypatch.setattr(stripe_service, "create_checkout_session", forbidden)
    monkeypatch.setattr(stripe_service, "create_billing_portal_session", forbidden)
    monkeypatch.setattr("stripe.Subscription.list", forbidden)
    monkeypatch.setattr("stripe.Invoice.list", forbidden)
    checkout = await client.post("/api/v1/billing/create-checkout?plan=pro", headers=auth_headers)
    assert checkout.status_code == 403
    portal = await client.get("/api/v1/billing/portal", headers=auth_headers)
    assert portal.status_code == 403
    subscription = await client.get("/api/v1/billing/subscription", headers=auth_headers)
    assert subscription.status_code == 200
    assert subscription.json()["plan"] == "pro"
    assert subscription.json()["customer_id"] is None
    invoices = await client.get("/api/v1/billing/invoices", headers=auth_headers)
    assert invoices.json() == {"invoices": []}
    assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("event_type", ["customer.subscription.created", "customer.subscription.deleted", "checkout.session.completed"])
async def test_stripe_events_cannot_change_domestic_membership(client, auth_headers, db_session, monkeypatch, event_type):
    user = (await db_session.execute(select(User))).scalar_one()
    monkeypatch.setattr(stripe_service, "verify_webhook", lambda *args: {
        "type": event_type,
        "data": {"object": {"customer": "cus_unrelated", "metadata": {"user_id": user.id, "plan": "enterprise"}}},
    })
    response = await client.post("/api/v1/billing/webhook", content=b"verified fixture")
    assert response.status_code == 200
    await db_session.refresh(user)
    assert user.subscription_plan == "pro"
    assert user.stripe_customer_id is None


@pytest.mark.asyncio
async def test_international_checkout_remains_available(client, auth_headers, db_session, monkeypatch):
    user = (await db_session.execute(select(User))).scalar_one()
    user.market = "global"
    await db_session.commit()
    create = Mock(return_value="https://checkout.stripe.com/test")
    monkeypatch.setattr(stripe_service, "create_checkout_session", create)
    response = await client.post("/api/v1/billing/create-checkout?plan=pro", headers=auth_headers)
    assert response.status_code == 200
    create.assert_called_once_with(user.id, "pro", None)
