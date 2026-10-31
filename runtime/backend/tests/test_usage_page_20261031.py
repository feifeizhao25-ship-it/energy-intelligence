"""GET /billing/usage feeds the quota page: plan, real usage, project count, reset dates, in the account's language."""
import re

import pytest

from tests.test_reports_flow_20261031 import _project


async def _free_user(db_session, market):
    import uuid
    from app.core.security import create_access_token, hash_password
    from app.models.user import User
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="f", role="user", market=market, subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_usage_page_data_for_a_domestic_free_user(client, db_session):
    auth_headers = await _free_user(db_session, "cn")
    r = await client.get("/api/v1/billing/usage", headers=auth_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    cats = {i["category"]: i for i in d["items"]}
    assert set(cats) == {"ai_queries", "report_exports", "projects"}
    assert cats["ai_queries"]["limit"] == 5 and cats["ai_queries"]["period"] == "day"
    assert cats["projects"]["used"] == 0 and cats["projects"]["limit"] == 1 and cats["projects"]["period"] == "total"
    assert d["plan_name"] == "免费" and any("AI" in f for f in d["plan_features"])
    assert d["resets"]["timezone"] == "UTC" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d["resets"]["day"])
    assert d["resets"]["month"].endswith("-01")


@pytest.mark.asyncio
async def test_usage_counts_real_projects_and_flags_the_limit(client, db_session):
    auth_headers = await _free_user(db_session, "cn")
    await _project(client, auth_headers)
    d = (await client.get("/api/v1/billing/usage", headers=auth_headers)).json()
    p = {i["category"]: i for i in d["items"]}["projects"]
    assert p["used"] == 1 and p["remaining"] == 0 and p["warning_level"] == "blocked"


@pytest.mark.asyncio
async def test_usage_page_is_english_for_the_international_edition(client, db_session):
    gh = await _free_user(db_session, "global")
    d = (await client.get("/api/v1/billing/usage", headers=gh)).json()
    assert d["plan_name"] == "Evaluation"
    assert d["plan_features"] and not any(re.search(r"[\u4e00-\u9fff]", f) for f in d["plan_features"])
    assert not re.search(r"[\u4e00-\u9fff]", d["plan_name"])


@pytest.mark.asyncio
async def test_usage_requires_login(client):
    assert (await client.get("/api/v1/billing/usage")).status_code == 401
