import pytest


PAYLOAD = {
    "cleaning_cost_usd": 1200,
    "daily_revenue_usd": 18000,
    "soiling_rate_fraction_per_day": 0.003,
}


@pytest.mark.asyncio
async def test_cleaning_calculation_requires_auth(client):
    response = await client.post("/api/v1/operations/cleaning/calculate", json=PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_cleaning_calculation_has_auditable_assumptions(client, auth_headers):
    response = await client.post("/api/v1/operations/cleaning/calculate", json=PAYLOAD, headers=auth_headers)
    assert response.status_code == 200
    result = response.json()
    assert result["optimal_interval_days"] == 7
    assert result["model_version"] == "cleaning-economic-interval-v1.0"
    assert result["assumptions"]["source"] == "user_input"
    assert result["total_annual_cost"] > 0


@pytest.mark.asyncio
async def test_domestic_cleaning_names_the_amount_in_cny(client, auth_headers):
    response = await client.post(
        "/api/v1/operations/cleaning/calculate",
        json={
            "cleaning_cost_cny": 1200,
            "daily_revenue_cny": 18000,
            "soiling_rate_fraction_per_day": 0.003,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assumptions = response.json()["assumptions"]
    assert assumptions["currency"] == "CNY"
    assert assumptions["cleaning_cost_cny"] == 1200
    assert assumptions["daily_revenue_cny"] == 18000
    assert "cleaning_cost_usd" not in assumptions


@pytest.mark.asyncio
async def test_domestic_cleaning_still_accepts_the_old_usd_field_names(client, auth_headers):
    response = await client.post(
        "/api/v1/operations/cleaning/calculate",
        json=PAYLOAD,
        headers=auth_headers,
    )
    assumptions = response.json()["assumptions"]
    assert assumptions["currency"] == "CNY"
    assert assumptions["cleaning_cost_cny"] == 1200
    assert assumptions["cleaning_cost_usd"] == 1200
    assert assumptions["legacy_usd_keys"] == "旧字段已接受，未做汇率换算，金额就是请求里的数字"


@pytest.mark.asyncio
async def test_global_cleaning_keeps_usd_field_names(client, auth_headers):
    response = await client.post(
        "/api/v1/operations/cleaning/calculate",
        json=PAYLOAD,
        headers={**auth_headers, "X-App-Market": "global"},
    )
    assumptions = response.json()["assumptions"]
    assert assumptions["currency"] == "USD"
    assert assumptions["cleaning_cost_usd"] == 1200
    assert "cleaning_cost_cny" not in assumptions


@pytest.mark.asyncio
async def test_cleaning_calculation_rejects_invalid_soiling_rate(client, auth_headers):
    response = await client.post(
        "/api/v1/operations/cleaning/calculate",
        json={**PAYLOAD, "soiling_rate_fraction_per_day": 0},
        headers=auth_headers,
    )
    assert response.status_code == 422
