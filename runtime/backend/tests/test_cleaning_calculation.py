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
async def test_cleaning_calculation_rejects_invalid_soiling_rate(client, auth_headers):
    response = await client.post(
        "/api/v1/operations/cleaning/calculate",
        json={**PAYLOAD, "soiling_rate_fraction_per_day": 0},
        headers=auth_headers,
    )
    assert response.status_code == 422
