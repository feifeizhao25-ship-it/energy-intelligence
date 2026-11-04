"""I-14: a real, per-user daily layout next to the labelled demo one."""
import re
import uuid

import pytest

from app.models.database import Project

from .test_personal_workbench_20261031 import CJK, _make_user


@pytest.mark.asyncio
async def test_demo_layout_is_labelled_as_demo(client):
    r = await client.get("/api/v1/personalization/daily-layout", params={"persona_id": "chen_xin", "day": 2})
    assert r.json()["data"]["source"] == "demo"


@pytest.mark.asyncio
async def test_my_layout_requires_login(client):
    assert (await client.get("/api/v1/personalization/daily-layout/me")).status_code == 401


@pytest.mark.asyncio
async def test_my_layout_comes_from_the_users_own_data_and_follows_it(client, db_session):
    u, h = await _make_user(db_session)
    first = (await client.get("/api/v1/personalization/daily-layout/me?tz=Asia/Shanghai", headers=h)).json()["data"]
    assert first["source"] == "user_data" and first["persona_id"] is None and first["personalized"] is True
    assert first["widgets"] and all(w["evidence_status"] == "user_data" and w["reason"] for w in first["widgets"])
    assert CJK.search(first["hero"]["headline"])
    db_session.add(Project(id=str(uuid.uuid4()), user_id=u.id, name="张家口光伏", technology="solar", location="河北张家口", status="draft"))
    await db_session.commit()
    second = (await client.get("/api/v1/personalization/daily-layout/me?tz=Asia/Shanghai", headers=h)).json()["data"]
    assert "张家口光伏" in second["hero"]["headline"]
    assert second["day_stage"] != first["day_stage"]


@pytest.mark.asyncio
async def test_my_layout_is_english_for_international_users_and_isolated(client, db_session):
    u1, h1 = await _make_user(db_session, market="global", country="Germany")
    u2, h2 = await _make_user(db_session)
    db_session.add(Project(id=str(uuid.uuid4()), user_id=u1.id, name="Only-Mine", technology="wind", status="draft"))
    await db_session.commit()
    a = (await client.get("/api/v1/personalization/daily-layout/me", headers=h1)).json()["data"]
    b = (await client.get("/api/v1/personalization/daily-layout/me", headers=h2)).json()["data"]
    assert not CJK.search(str(a)), a
    assert "Only-Mine" in str(a) and "Only-Mine" not in str(b)
