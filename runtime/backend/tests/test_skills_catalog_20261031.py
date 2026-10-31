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


# ---- regression: every registered skill must be listable, describable and schema-able -------------------
import json
import re
from pathlib import Path

from app.skills.base import review_register
from app.skills.registry import get_registry

_IDS = sorted(m.skill_id for m in get_registry().list_skills())


def test_catalog_is_not_empty_and_ids_are_unique():
    metas = get_registry().list_skills()
    assert len(_IDS) == len(set(_IDS)) == len(metas) > 0


@pytest.mark.parametrize("skill_id", _IDS)
def test_every_skill_has_complete_catalog_metadata(skill_id):
    meta = get_registry().get_meta(skill_id)
    d = meta.to_dict()
    assert d["name"].strip() and d["description"].strip() and d["category"].strip()
    assert isinstance(d["references"], list)
    assert d["review_status"] in ("reviewed", "unreviewed")
    if d["review_status"] == "unreviewed":
        assert not d["reviewed_by"] and not d["reviewed_at"]


@pytest.mark.asyncio
async def test_every_skill_detail_and_schema_endpoint_answers(client, auth_headers):
    bad = []
    for sid in _IDS:
        for suffix in ("", "/schema"):
            r = await client.get(f"/api/v1/skills/{sid}{suffix}", headers=auth_headers)
            if r.status_code != 200:
                bad.append((sid, suffix, r.status_code))
    assert not bad, bad[:10]


@pytest.mark.asyncio
async def test_catalog_exposes_review_fields_empty_until_a_person_reviews(client, auth_headers):
    items = (await client.get("/api/v1/skills", headers=auth_headers)).json()["data"]["items"]
    assert items and all({"references", "reviewed_by", "reviewed_at", "review_status"} <= set(i) for i in items)
    reg = review_register()
    for i in items:
        if i["skill_id"] not in reg:
            assert i["reviewed_by"] is None and i["reviewed_at"] is None and i["review_status"] == "unreviewed"


def test_review_register_only_holds_real_review_records():
    """The register ships empty. Any entry must name a reviewer, carry a date and have at least one reference
    link, and must belong to a skill that exists. An entry with a blank reviewer is rejected, not defaulted."""
    ids = set(_IDS)
    for sid, e in review_register().items():
        assert sid in ids, f"{sid}: not a registered skill"
        assert str(e.get("reviewed_by", "")).strip(), f"{sid}: reviewer missing"
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(e.get("reviewed_at", ""))), f"{sid}: reviewed_at must be YYYY-MM-DD"
        refs = e.get("references") or []
        assert refs and all(str(r.get("url", "")).startswith(("http://", "https://")) and r.get("title") for r in refs), sid


def test_register_file_is_valid_json_object():
    path = Path(__file__).resolve().parents[1] / "app" / "skills" / "review_register.json"
    assert isinstance(json.loads(path.read_text(encoding="utf-8")), dict)
