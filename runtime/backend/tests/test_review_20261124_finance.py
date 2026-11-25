"""能3、能4、能5、智4、智5：储能净收入、三套收益率、报告复用测算结果。"""
import pytest

from app.utils.financial_utils import evaluate_power_project

STORAGE_REVIEW = {
    "power_mw": 10,
    "capacity_mwh": 20,
    "cycles_per_year": 300,
    "peak_price_per_mwh": 800,
    "offpeak_price_per_mwh": 300,
    "capex_per_kwh": 1200,
    "roundtrip_efficiency": 0.88,
    "currency": "CNY",
    "project_life": 15,
}

SOLAR_LEVERED = {
    "capacity_mw": 5,
    "capex_per_w": 3.2,
    "opex_per_kw_yr": 70,
    "electricity_price": 0.3844,
    "capacity_factor": 0.15,
    "debt_ratio": 0.7,
    "interest_rate": 0.045,
    "tax_rate": 0.25,
    "project_life": 25,
    "currency": "CNY",
    "itc_rate": 0,
}


@pytest.mark.asyncio
async def test_storage_net_revenue_charges_the_extra_import(client, auth_headers):
    response = await client.post("/api/v1/finance/storage", json=STORAGE_REVIEW, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["annual_discharged_mwh"] == pytest.approx(5280)
    assert body["annual_charged_mwh"] == pytest.approx(6000)
    assert body["annual_revenue"] == pytest.approx(2_424_000)
    assert body["lcos_including_charging_cost"] > body["lcos_excluding_charging_cost"]
    assert "未计" in body["assumptions"]["tax"]
    assert "未计" in body["assumptions"]["battery_replacement"]
    joined = " ".join(str(value) for value in body["assumptions"].values())
    assert "ITC" not in joined and "投资税收抵免" not in joined


@pytest.mark.asyncio
async def test_solar_irr_is_not_the_equity_irr_and_states_its_basis(client, auth_headers):
    response = await client.post("/api/v1/finance/solar", json=SOLAR_LEVERED, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["irr"] != body["equity_irr"]
    assert body["project_irr_pretax"] != body["project_irr_aftertax"]
    assert body["discount_rate"] == pytest.approx(0.08)
    text = " ".join(body["assumptions"])
    assert "折现率" in text and "折旧" in text and "资本金" in text
    assert "ITC" not in text and "投资税收抵免" not in text
    assert body["basis"]["depreciation_method"] == "straight_line"
    assert body["basis"]["itc_rate"] == 0


@pytest.mark.asyncio
async def test_unrecoverable_storage_payback_is_null(client, auth_headers):
    payload = {**STORAGE_REVIEW, "capex_per_kwh": 5000, "peak_price_per_mwh": 310, "offpeak_price_per_mwh": 300}
    response = await client.post("/api/v1/finance/storage", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    assert response.json()["payback_years"] is None


@pytest.mark.asyncio
async def test_saved_model_and_report_trace_match_the_finance_api(client, auth_headers):
    from tests.test_reports_flow_20261031 import _generate, _project

    project_id = await _project(client, auth_headers)
    calculated = (await client.post("/api/v1/finance/solar", json=SOLAR_LEVERED, headers=auth_headers)).json()
    saved = await client.post(f"/api/v1/finance/models/{project_id}", json={
        **SOLAR_LEVERED,
        "data_sources": [{"title": "用户填写的电价", "url": "https://example.com/user-input", "retrieved_at": "2026-11-24"}],
    }, headers=auth_headers)
    assert saved.status_code == 200, saved.text
    assert saved.json()["npv"] == pytest.approx(calculated["npv"], abs=0.02)
    assert saved.json()["lcoe"] == pytest.approx(calculated["lcoe"], abs=0.0001)
    assert saved.json()["irr"] == pytest.approx(calculated["irr"], abs=1e-4)
    report = await _generate(client, auth_headers, project_id)
    assert report.status_code == 200, report.text
    trace = {row["formula"]: row["result"] for row in report.json()["evidence"]["calculation_trace"]}
    assert trace["净现值按全投资税后现金流和折现率折现，与测算接口同一套函数。"] == pytest.approx(calculated["npv"], abs=0.02)
    assert trace["全投资税后内部收益率（百分数），与测算接口的 irr 相同。"] == pytest.approx(calculated["irr"], abs=1e-6)
    assert trace["LCOE = 成本现值 / 发电量现值（分子和分母都折现）。"] == pytest.approx(calculated["lcoe"], abs=1e-6)
    assert trace["资本金回收期（年）。寿命期内无法回收时为空。"] == calculated["payback_years"]
    verification = report.json()["evidence"]["verification"]
    assert verification["label"] == "用户提供"
    assert "用户填写" in verification["reason"]
    assert not any("不得作为结论依据" in line for line in report.json()["evidence"]["limitations"])


def test_us_project_discloses_macrs_and_separates_the_two_irrs():
    metrics = evaluate_power_project(
        capacity_mw=2, capex_per_w=1.0, opex_per_kw_yr=15, electricity_price=40,
        itc_rate=0.30, capacity_factor=0.22, degradation_rate=0.005, debt_ratio=0.6,
        interest_rate=0.06, tax_rate=0.21, project_life=25, currency="USD", discount_rate=0.08,
        depreciation_method=None, depreciation_years=20, residual_rate=0.05, itc_basis_reduction=None,
        ptc_per_mwh=0, en=True, kind="wind", discount_rate_defaulted=True,
    )
    assert metrics["irr"] != metrics["equity_irr"]
    assert metrics["basis"]["depreciation_method"] == "macrs_5"
    assert metrics["basis"]["itc_basis_reduction"] == pytest.approx(0.5)
    assert metrics["discount_rate"] == pytest.approx(0.08)
    assert any("MACRS" in line for line in metrics["assumptions"])
    assert any("Production tax credit" in line for line in metrics["assumptions"])
