"""共1：同一用户的档位、额度和到期日，在用户信息、用量、订阅和计划列表里逐项相同。"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token, hash_password
from app.models.user import User


async def _user(db_session, market: str):
    expires = datetime(2027, 6, 1, 8, 0, tzinfo=timezone.utc)
    user = User(
        id=str(uuid.uuid4()),
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("TestPass123!"),
        name="权益核对",
        role="user",
        market=market,
        subscription_plan="pro",
        subscription_expires_at=expires,
        usage_quota={},
    )
    db_session.add(user)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}, expires


@pytest.mark.asyncio
async def test_one_user_has_one_entitlement_across_apis(client, db_session):
    headers, _expires = await _user(db_session, "cn")
    usage = (await client.get("/api/v1/billing/usage", headers=headers)).json()
    subscription = (await client.get("/api/v1/billing/subscription", headers=headers)).json()
    me = (await client.get("/api/v1/me", headers=headers)).json()["data"]
    plans = (await client.get("/api/v1/billing/plans")).json()["data"]["plans"]
    pro = next(item for item in plans if item["id"] == "pro")
    ai_limit = next(item["limit"] for item in usage["items"] if item["category"] == "ai_queries")

    assert usage["plan"] == subscription["plan"] == me["subscription_plan"] == pro["id"] == "pro"
    assert usage["plan_name"] == subscription["plan_name"] == me["plan_name"] == pro["name"] == "标准·数据库订阅"
    assert ai_limit == me["quotas"]["ai_queries_per_day"] == pro["ai_queries_per_day"] == 100
    assert usage["expires_at"] == subscription["expires_at"] == subscription["current_period_end"] == me["expires_at"]
    assert usage["expires_at"].startswith("2027-06-01")


@pytest.mark.asyncio
async def test_global_entitlement_uses_the_english_name(client, db_session):
    headers, _expires = await _user(db_session, "global")
    usage = (await client.get("/api/v1/billing/usage", headers=headers)).json()
    me = (await client.get("/api/v1/me", headers=headers)).json()["data"]
    assert usage["plan"] == me["subscription_plan"] == "pro"
    assert usage["plan_name"] == me["plan_name"] == "Professional"
    assert "标准" not in usage["plan_name"]
    assert usage["expires_at"] == me["expires_at"]
    assert usage["expires_at"].startswith("2027-06-01")
