"""POST /api/v1/finance/lcoe uses calc_lcoe and the backend response envelope."""
import pytest

pytestmark = pytest.mark.asyncio

INPUTS = {
    "capex": 400_000_000,
    "annual_opex": 5_000_000,
    "annual_gen_kwh": 250_000_000,
    "discount_rate": 0.06,
    "lifetime": 25,
}


async def test_lcoe_requires_login(client):
    response = await client.post("/api/v1/finance/lcoe", json=INPUTS)
    assert response.status_code == 401


async def test_lcoe_matches_the_shared_formula(client, auth_headers):
    from app.utils.financial_utils import calc_lcoe
    response = await client.post("/api/v1/finance/lcoe", json=INPUTS, headers=auth_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    expected = calc_lcoe(400_000_000, 5_000_000, 250_000_000, 0.06, 25)
    assert body["code"] == 0
    assert body["data"]["lcoe"] == expected
    assert 0.1 < body["data"]["lcoe"] < 0.5
    assert body["data"]["unit"] == "CNY/kWh"


async def test_lcoe_rejects_non_positive_generation(client, auth_headers):
    response = await client.post(
        "/api/v1/finance/lcoe",
        json={**INPUTS, "annual_gen_kwh": 0},
        headers=auth_headers,
    )
    assert response.status_code == 422
