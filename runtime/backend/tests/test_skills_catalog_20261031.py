"""GET /skills and /skills/categories returned 500 ('SkillMeta' object has no attribute 'to_dict')."""

import pytest

from app.skills.base import SkillMeta


def test_skill_meta_to_dict_round_trips_all_fields():
    meta = SkillMeta(skill_id="FM-001", name="LCOE", description="d", category="finance", service="svc", tags=["a"])
    out = meta.to_dict()
    assert out["skill_id"] == "FM-001" and out["tags"] == ["a"] and out["category"] == "finance"
    out["tags"].append("x")
    assert meta.tags == ["a"], "to_dict must copy lists"


@pytest.mark.asyncio
async def test_skills_catalog_endpoints_work(client, auth_headers):
    r = await client.get("/api/v1/skills", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["total"] == len(data["items"]) > 0
    assert {"skill_id", "name", "description", "category"} <= set(data["items"][0])
    ids = [i["skill_id"] for i in data["items"]]
    assert len(ids) == len(set(ids)), "skill ids must be unique"

    cats = await client.get("/api/v1/skills/categories", headers=auth_headers)
    assert cats.status_code == 200, cats.text
    assert cats.json()["data"]["total_categories"] > 0

    one = await client.get(f"/api/v1/skills/{ids[0]}", headers=auth_headers)
    assert one.status_code == 200, one.text
