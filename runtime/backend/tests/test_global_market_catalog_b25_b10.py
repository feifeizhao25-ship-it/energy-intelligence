"""B25/B10: the international (X-App-Market: global) API must be English, never CNY, never an invented price.

Reproduces the retest findings: /entitlements, /billing/plans, /billing/rules, /skills, /skills/categories,
skill results, /reports/templates and /research/market-trends returned Chinese text, CNY and China-only data
to international callers.
"""
import json
import re

import pytest

from app.services import market_localization as ml

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]")
GL = {"X-App-Market": "global"}


def _no_cjk(obj, where=""):
    text = json.dumps(obj, ensure_ascii=False)
    found = CJK.findall(text)
    assert not found, f"{where}: Chinese text in international response: {''.join(found[:20])} in {text[:300]}"


@pytest.fixture(autouse=True)
def _fresh_price_cache():
    ml.clear_price_cache()
    yield
    ml.clear_price_cache()


@pytest.fixture
def no_stripe(monkeypatch):
    from app.services.stripe_service import StripeService
    monkeypatch.setattr(StripeService, "get_price", staticmethod(lambda plan: None))


@pytest.mark.asyncio
async def test_entitlements_global_is_english_without_cny(client, no_stripe):
    r = await client.get("/api/entitlements", headers=GL)
    assert r.status_code == 200
    data = r.json()
    _no_cjk(data, "/entitlements")
    assert data["product"] == "Energy Intelligence"
    assert "cny" not in json.dumps(data).lower()
    for tier in data["tiers"].values():
        assert tier["name"] and tier["description"] and tier["features"]
        assert tier["price"]["currency"] in (None, "USD", "EUR", "GBP") and "yearly_cny" not in tier["price"]
    # the old fake: prices are null unless Stripe supplies them
    assert data["tiers"]["pro"]["price"]["amount_cents"] is None


@pytest.mark.asyncio
async def test_entitlements_domestic_unchanged(client):
    data = (await client.get("/api/entitlements")).json()
    assert data["product"] == "新能源智库"
    assert data["tiers"]["pro"]["price"]["yearly_cny"] == 1980


@pytest.mark.asyncio
async def test_legacy_x_market_header_is_still_honoured(client, no_stripe):
    r = await client.get("/api/entitlements", headers={"X-Market": "global"})
    assert r.json()["product"] == "Energy Intelligence"


@pytest.mark.asyncio
async def test_plans_global_english_no_cny_no_invented_price(client, no_stripe):
    r = await client.get("/api/v1/billing/plans", headers=GL)
    plans = r.json()["data"]["plans"]
    _no_cjk(plans, "/billing/plans")
    assert [p["id"] for p in plans] == ["free", "pro", "full", "team", "enterprise"]
    for p in plans:
        assert p["currency"] != "CNY"
    pro = next(p for p in plans if p["id"] == "pro")
    assert pro["name"] == "Standard" or pro["name"].isascii()
    assert pro["price_cents"] is None and pro["price"]["note"]


@pytest.mark.asyncio
async def test_plans_global_uses_real_stripe_price_only(client, monkeypatch):
    from app.services.stripe_service import StripeService
    monkeypatch.setattr(
        StripeService, "get_price",
        staticmethod(lambda plan: {"amount_cents": 41900, "currency": "usd", "interval": "year"} if plan == "pro" else None),
    )
    plans = (await client.get("/api/v1/billing/plans", headers=GL)).json()["data"]["plans"]
    pro = next(p for p in plans if p["id"] == "pro")
    assert (pro["price_cents"], pro["currency"], pro["price"]["source"]) == (41900, "USD", "stripe")
    ent = next(p for p in plans if p["id"] == "enterprise")
    assert ent["price_cents"] is None


@pytest.mark.asyncio
async def test_plans_domestic_still_cny(client):
    plans = (await client.get("/api/v1/billing/plans")).json()["data"]["plans"]
    pro = next(p for p in plans if p["id"] == "pro")
    assert pro["currency"] == "CNY" and pro["price_cents"] == 198000 and pro["name"] == "专业版"


@pytest.mark.asyncio
async def test_billing_rules_global_english(client):
    r = await client.get("/api/v1/billing/rules", headers=GL)
    body = r.json()
    _no_cjk(body, "/billing/rules")
    assert body["billing_period"] == "yearly" and body["renewal"] and body["refund"]
    cn = (await client.get("/api/v1/billing/rules")).json()
    assert "按年付续" in cn["renewal"]


@pytest.mark.asyncio
async def test_skills_catalog_global_english_and_hides_china_only(client, auth_headers):
    h = {**auth_headers, **GL}
    items = (await client.get("/api/v1/skills", headers=h)).json()["data"]
    _no_cjk(items, "/skills")
    ids = {i["skill_id"] for i in items["items"]}
    assert "FM-001" in ids and "CA-001" not in ids
    assert items["total"] == len(items["items"])
    cats = (await client.get("/api/v1/skills/categories", headers=h)).json()["data"]
    _no_cjk(cats, "/skills/categories")
    assert "CA" not in {c["category"] for c in cats["categories"]}
    assert (await client.get("/api/v1/skills/CA-001", headers=h)).status_code == 404
    one = await client.get("/api/v1/skills/FM-001", headers=h)
    _no_cjk(one.json(), "/skills/FM-001")
    # domestic list keeps everything in Chinese
    cn = (await client.get("/api/v1/skills", headers=auth_headers)).json()["data"]
    assert "CA-001" in {i["skill_id"] for i in cn["items"]}


_SKILL_PARAMS = {
    "FM-001": {"capex": 1_000_000, "opex_annual": 15_000, "annual_generation_kwh": 1_800_000},
    "FM-002": {"cashflows": [-1000, 200, 250, 300, 350, 400]},
    "OM-001": {"pr_loss_pct": 4.0, "dust_level": "medium", "cleaning_cost": 450, "daily_revenue": 900, "rainfall_30d_mm": 5},
    "RA-001": {"latitude": 35.0, "longitude": -110.0, "ghi_annual_kwh_m2": 1900, "capacity_mw": 10},
    "RA-002": {"latitude": 55.0, "longitude": 5.0, "mean_speed_ms": 7.5, "capacity_mw": 10},
    "ST-001": {"pv_capacity_mw": 10, "profile": "clear", "target": "self_consumption", "target_self_consumption": 0.6, "storage_cost_cny_per_kwh": 1200},
}


@pytest.mark.asyncio
@pytest.mark.parametrize("skill_id", sorted(_SKILL_PARAMS))
async def test_skill_results_global_have_no_chinese(client, auth_headers, skill_id):
    r = await client.post(f"/api/v1/skills/{skill_id}/execute", headers={**auth_headers, **GL}, json=_SKILL_PARAMS[skill_id])
    assert r.status_code == 200, r.text
    body = r.json()
    _no_cjk(body, f"/skills/{skill_id}/execute")
    refs = json.dumps(body["data"].get("data", body["data"]), ensure_ascii=False)
    assert "GB/T" not in refs and "CNESA" not in refs and "发改委" not in refs


@pytest.mark.asyncio
async def test_skill_error_global_is_english(client, auth_headers):
    r = await client.post("/api/v1/skills/FM-001/execute", headers={**auth_headers, **GL}, json={})
    assert r.status_code == 422
    _no_cjk(r.json(), "skill error")


@pytest.mark.asyncio
async def test_chinese_only_skill_not_executable_in_global(client, auth_headers):
    r = await client.post("/api/v1/skills/CA-001/execute", headers={**auth_headers, **GL}, json={})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_report_templates_follow_header_market(client, auth_headers):
    gl = (await client.get("/api/v1/reports/templates", headers={**auth_headers, **GL})).json()
    _no_cjk(gl, "/reports/templates")
    cn = (await client.get("/api/v1/reports/templates", headers=auth_headers)).json()
    assert CJK.search(json.dumps(cn, ensure_ascii=False))


@pytest.mark.asyncio
async def test_market_trends_global_has_no_china_only_enterprises(client, auth_headers):
    gl = (await client.get("/api/v1/research/market-trends", headers={**auth_headers, **GL})).json()
    _no_cjk(gl, "/research/market-trends")
    assert "top_companies" not in gl and not any(k.startswith("china_") for k in gl)
    assert "IRA" not in json.dumps(gl) and "GBI" not in json.dumps(gl)
    cn = (await client.get("/api/v1/research/market-trends", headers=auth_headers)).json()
    assert cn["top_companies"]
