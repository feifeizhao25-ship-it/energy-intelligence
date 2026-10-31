"""Creating a project respects the plan's project limit (the Plan & usage page already shows it), in the account's
language. Uses the live contract (routers/projects.py): capacity_kw + location object."""
import re
import uuid

import pytest

from app.core.security import create_access_token, hash_password
from app.models.user import User

BODY = {"name": "Test solar plant", "technology": "solar_pv", "capacity_kw": 20000,
        "location": {"latitude": 31.2, "longitude": 121.5, "address": "Shanghai"}}


async def _user(db_session, market, plan="free"):
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="p", role="user", market=market, subscription_plan=plan, usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
@pytest.mark.parametrize("market", ["cn", "global"])
async def test_free_plan_gets_one_project_then_a_clear_upgrade_message(client, db_session, market):
    h = await _user(db_session, market)
    first = await client.post("/api/v1/projects", headers=h, json=BODY)
    assert first.status_code == 201, first.text
    assert first.json()["data"]["technology"] == "solar_pv"
    second = await client.post("/api/v1/projects", headers=h, json={**BODY, "name": "Second plant"})
    assert second.status_code == 429
    body = second.json()
    text = second.text
    assert "PROJECT_QUOTA_EXCEEDED" in text and "/pricing" in text
    message = body["detail"]["message"] if "detail" in body else body.get("message", "")
    assert bool(re.search(r"[\u3400-\u9fff]", message)) == (market == "cn")
    assert ("Upgrade your plan" in message) == (market == "global")
    listed = await client.get("/api/v1/projects", headers=h)
    assert len(listed.json()["data"]) == 1


@pytest.mark.asyncio
async def test_paid_plan_can_create_more_projects(client, db_session):
    h = await _user(db_session, "global", plan="pro")
    for n in range(3):
        r = await client.post("/api/v1/projects", headers=h, json={**BODY, "name": f"Plant number {n}"})
        assert r.status_code == 201, r.text
