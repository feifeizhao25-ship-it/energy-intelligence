"""Storage projects can save a model and produce reports from the user's own, cited assumptions."""
import re

import pytest

from tests.test_report_data_sources_20261031 import SRC, _global_user
from tests.test_reports_flow_20261031 import _generate, _project

STORAGE = {
    "power_mw": 20, "capacity_mwh": 40, "cycles_per_year": 330,
    "peak_price_per_mwh": 120, "offpeak_price_per_mwh": 40, "capex_per_kwh": 250,
    "roundtrip_efficiency": 0.86, "project_life": 12, "currency": "USD",
}


@pytest.mark.asyncio
async def test_storage_model_saves_with_same_numbers_as_the_calculator(client, auth_headers):
    pid = await _project(client, auth_headers)
    calc = (await client.post("/api/v1/finance/storage", headers=auth_headers, json=STORAGE)).json()
    saved = await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=STORAGE)
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert body["npv"] == pytest.approx(calc["npv"], abs=0.01)
    assert body["lcoe"] == pytest.approx(calc["lcos"], abs=0.001)
    assert body["scenario_name"] == "Storage arbitrage"


@pytest.mark.asyncio
async def test_storage_saved_assumptions_say_what_was_not_entered(client, auth_headers, db_session):
    from sqlalchemy import select
    from app.models.cashflow import CashflowProjection
    pid = await _project(client, auth_headers)
    await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=STORAGE)
    cf = (await db_session.execute(select(CashflowProjection).where(CashflowProjection.project_id == pid))).scalars().first()
    a = cf.yearly_cashflows["assumptions"]
    assert a["model_type"] == "storage_arbitrage"
    assert a["assumption_provenance"]["capex_per_kwh"] == "user_input"
    assert a["assumption_provenance"]["roundtrip_efficiency"] == "user_input"
    assert a["assumption_provenance"]["annual_degradation_rate"] == "engine_default_not_sourced"
    assert set(a["defaulted_assumptions"]) == {"annual_degradation_rate", "annual_opex_rate", "discount_rate"}
    # revenue in the report maths equals discharged energy x spread, i.e. what the model computed
    assert a["annual_generation_mwh"] * a["electricity_price"] * 1000 == pytest.approx(
        STORAGE["capacity_mwh"] * STORAGE["cycles_per_year"] * STORAGE["roundtrip_efficiency"] * 80, rel=1e-6)


@pytest.mark.asyncio
async def test_storage_rejects_flat_or_inverted_prices_and_other_users_projects(client, auth_headers, db_session):
    pid = await _project(client, auth_headers)
    bad = dict(STORAGE, peak_price_per_mwh=40)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=bad)).status_code == 422
    other = await _global_user(db_session)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=other, json=STORAGE)).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("market", ["cn", "global"])
async def test_storage_report_needs_a_source_then_generates(client, auth_headers, db_session, tmp_path, monkeypatch, market):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    headers = auth_headers if market == "cn" else await _global_user(db_session)
    pid = await _project(client, headers)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=headers, json=STORAGE)).status_code == 200
    assert (await _generate(client, headers, pid, market=market)).status_code == 422  # no source registered
    assert (await client.put(f"/api/v1/finance/data-sources/{pid}", headers=headers, json={"sources": [SRC]})).status_code == 200
    ok = await _generate(client, headers, pid, market=market)
    assert ok.status_code == 200, ok.text


@pytest.mark.asyncio
async def test_storage_data_sources_can_be_sent_with_the_model(client, auth_headers):
    pid = await _project(client, auth_headers)
    r = await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=dict(STORAGE, data_sources=[SRC]))
    assert r.status_code == 200
    got = await client.get(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers)
    assert got.json()["sources"][0]["title"] == SRC["title"]


def test_storage_report_rows_state_defaults_in_both_languages():
    from app.routers.reports import _storage_assumption_rows
    from app.services.report_global import build_report  # noqa: F401
    fin = {"model_type": "storage_arbitrage", "defaulted_assumptions": ["annual_opex_rate"]}
    rows = _storage_assumption_rows(fin)
    assert any("未核实来源" in r[0] and "年运维费率" in r[1] for r in rows)
    assert _storage_assumption_rows({}) == []


@pytest.mark.asyncio
async def test_storage_sources_sent_with_the_model_are_validated(client, auth_headers):
    pid = await _project(client, auth_headers)
    r = await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=dict(STORAGE, data_sources=[{"url": "https://x.org"}]))
    assert r.status_code == 422 and "缺少标题" in r.json()["detail"]
