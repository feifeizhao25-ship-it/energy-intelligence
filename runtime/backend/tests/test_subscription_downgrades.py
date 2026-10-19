from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from app.models.user import User
from app.database import AsyncSessionLocal
from app.services.subscription_downgrades import process_due_downgrades


@pytest.mark.asyncio
@pytest.mark.parametrize('case', ['due', 'future', 'renewed', 'upgraded', 'invalid', 'international', 'free_target'])
async def test_due_processing_preserves_paid_period_and_usage(db_session, auth_headers, case):
    now = datetime.now(timezone.utc)
    expiry = now - timedelta(days=1)
    user = (await db_session.execute(select(User))).scalar_one()
    user.subscription_plan = 'full'
    user.subscription_expires_at = expiry
    intent = {'from_plan': 'full', 'to_plan': 'pro', 'effective_at': expiry.isoformat(), 'status': 'scheduled'}
    if case == 'future':
        user.subscription_expires_at = now + timedelta(days=1)
        intent['effective_at'] = user.subscription_expires_at.isoformat()
    if case == 'renewed':
        user.subscription_expires_at = now + timedelta(days=365)
    if case == 'upgraded':
        user.subscription_plan = 'team'
    if case == 'invalid':
        intent['to_plan'] = 'enterprise'
    if case == 'international':
        user.market = 'global'
    if case == 'free_target':
        intent['to_plan'] = 'free'
    user.usage_quota = {'ai_calls': {'today': 7}, 'scheduled_downgrade': intent}
    await db_session.commit()
    expected_expiry = user.subscription_expires_at
    async with AsyncSessionLocal() as session:
        async with session.begin():
            counts = await process_due_downgrades(session, now=now)
    async with AsyncSessionLocal() as session:
        saved = await session.get(User, user.id)
        assert saved.usage_quota['ai_calls'] == {'today': 7}
        assert saved.subscription_expires_at.replace(tzinfo=timezone.utc) == expected_expiry
        if case in ('due', 'free_target'):
            assert counts == {'applied': 1, 'cancelled': 0}
            assert saved.subscription_plan == intent['to_plan']
            assert saved.plan == 'free'
        elif case in ('upgraded', 'invalid'):
            assert counts == {'applied': 0, 'cancelled': 1}
            assert saved.subscription_plan == ('team' if case == 'upgraded' else 'full')
        else:
            assert counts == {'applied': 0, 'cancelled': 0}
            assert saved.subscription_plan == 'full'
        assert await process_due_downgrades(session, now=now) == {'applied': 0, 'cancelled': 0}


@pytest.mark.asyncio
async def test_worker_owns_transaction_and_beat_is_registered(db_session, auth_headers):
    from app.tasks.subscriptions import run_due_downgrades
    from app.tasks.celery_app import celery_app
    user = (await db_session.execute(select(User))).scalar_one()
    expiry = datetime.now(timezone.utc) - timedelta(days=1)
    user.subscription_plan = 'full'
    user.subscription_expires_at = expiry
    user.usage_quota = {'scheduled_downgrade': {'status': 'scheduled', 'from_plan': 'full', 'to_plan': 'free', 'effective_at': expiry.isoformat()}}
    await db_session.commit()
    assert await run_due_downgrades() == {'applied': 1, 'cancelled': 0}
    async with AsyncSessionLocal() as session:
        assert (await session.get(User, user.id)).subscription_plan == 'free'
    entry = celery_app.conf.beat_schedule['subscription-downgrades']
    assert entry['task'] in celery_app.tasks
    assert entry['schedule'] == 60.0


@pytest.mark.asyncio
async def test_postgres_locked_renewal_is_skipped_and_stale_intent_cancelled(db_session, auth_headers):
    if db_session.bind.dialect.name != 'postgresql':
        pytest.skip('requires PostgreSQL row locks')
    now = datetime.now(timezone.utc)
    expiry = now - timedelta(days=1)
    user = (await db_session.execute(select(User))).scalar_one()
    user.subscription_plan = 'full'
    user.subscription_expires_at = expiry
    user.usage_quota = {'scheduled_downgrade': {'status': 'scheduled', 'from_plan': 'full', 'to_plan': 'pro', 'effective_at': expiry.isoformat()}}
    await db_session.commit()
    async with AsyncSessionLocal() as renewal, AsyncSessionLocal() as scanner:
        locked = (await renewal.execute(select(User).where(User.id == user.id).with_for_update())).scalar_one()
        assert await process_due_downgrades(scanner, now=now) == {'applied': 0, 'cancelled': 0}
        await scanner.commit()
        locked.subscription_expires_at = now + timedelta(days=365)
        await renewal.commit()
        assert await process_due_downgrades(scanner, now=now) == {'applied': 0, 'cancelled': 0}
        await scanner.commit()
        # Old intent must not apply even after the renewed period expires.
        assert await process_due_downgrades(scanner, now=now + timedelta(days=366)) == {'applied': 0, 'cancelled': 1}
        await scanner.commit()
        scanner.expire_all()
        saved = await scanner.get(User, user.id)
        assert saved.subscription_plan == 'full'
