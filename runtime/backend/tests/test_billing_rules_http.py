"""Current runtime HTTP + actual JWT/SQLite evidence; no payment provider calls."""
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from app.models.user import User
from app.database import AsyncSessionLocal


@pytest.mark.asyncio
@pytest.mark.parametrize('expired', [False, True])
async def test_renewal_quote_uses_purchased_plan_even_after_expiry(client, auth_headers, db_session, expired):
    user = (await db_session.execute(select(User))).scalar_one()
    user.subscription_plan = 'pro'
    user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=-10 if expired else 30)
    await db_session.commit()
    response = await client.post('/api/v1/billing/renewal/quote', headers=auth_headers)
    assert response.status_code == 200, response.text
    assert response.json()['plan'] == 'pro'
    assert response.json()['amount_cny'] == '1980.00'
    assert datetime.fromisoformat(response.json()['new_expires_at']) > datetime.now(timezone.utc) + timedelta(days=364)
    async with AsyncSessionLocal() as session:
        persisted = await session.get(User, user.id)
        assert persisted.subscription_plan == 'pro'
        if expired:
            assert persisted.plan == 'free'  # A quote never reactivates entitlement.


@pytest.mark.asyncio
@pytest.mark.parametrize('amount', ['NaN', 'Infinity', 'invalid', '1.001'])
async def test_invalid_refund_amount_is_http_400(client, auth_headers, amount):
    response = await client.post('/api/v1/billing/refund/quote', headers=auth_headers,
        json={'paid_amount_cny': amount, 'period_start': '2026-01-01T00:00:00', 'period_end': '2027-01-01T00:00:00Z'})
    assert response.status_code == 400, response.text
    assert '金额' in response.json()['detail']


@pytest.mark.asyncio
async def test_downgrade_persists_intent_without_changing_plan(client, auth_headers, db_session):
    user = (await db_session.execute(select(User))).scalar_one()
    user.subscription_plan = 'full'
    user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    await db_session.commit()
    response = await client.post('/api/v1/billing/downgrade', headers=auth_headers, json={'plan': 'pro'})
    assert response.status_code == 200, response.text
    async with AsyncSessionLocal() as session:
        persisted = await session.get(User, user.id)
        assert persisted.plan == 'full'
        assert persisted.usage_quota['scheduled_downgrade'] == response.json()
        assert persisted.usage_quota['scheduled_downgrade']['to_plan'] == 'pro'


@pytest.mark.asyncio
@pytest.mark.parametrize('path,body', [('renewal/quote', {}), ('downgrade', {'plan': 'free'}), ('refund/quote', {'paid_amount_cny':'1', 'period_start':'2026-01-01', 'period_end':'2027-01-01'})])
async def test_billing_rule_routes_require_login(client, path, body):
    response = await client.post('/api/v1/billing/' + path, json=body)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_free_account_cannot_request_paid_renewal(client, auth_headers, db_session):
    user = (await db_session.execute(select(User))).scalar_one()
    user.subscription_plan = 'free'
    await db_session.commit()
    response = await client.post('/api/v1/billing/renewal/quote', headers=auth_headers)
    assert response.status_code == 400
    async with AsyncSessionLocal() as session:
        assert (await session.get(User, user.id)).subscription_plan == 'free'
