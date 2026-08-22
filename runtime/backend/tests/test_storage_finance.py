import pytest


PAYLOAD = {
    "power_mw": 100,
    "capacity_mwh": 400,
    "cycles_per_year": 250,
    "peak_price_per_mwh": 120,
    "offpeak_price_per_mwh": 30,
    "capex_per_kwh": 280,
}


@pytest.mark.asyncio
async def test_storage_finance_requires_auth(client):
    response = await client.post("/api/v1/finance/storage", json=PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_storage_finance_is_auditable(client, auth_headers):
    response = await client.post("/api/v1/finance/storage", json=PAYLOAD, headers=auth_headers)
    assert response.status_code == 200
    result = response.json()
    assert result["assumption_version"] == "storage-arbitrage-v1.0"
    assert result["assumptions"]["source"] == "user_input"
    assert len(result["cashflows"]) == 10
    assert result["total_capex"] == 112_000_000
    assert result["annual_discharged_mwh"] == 88_000


@pytest.mark.asyncio
async def test_storage_finance_rejects_nonpositive_spread(client, auth_headers):
    payload = {**PAYLOAD, "peak_price_per_mwh": 20}
    response = await client.post("/api/v1/finance/storage", json=payload, headers=auth_headers)
    assert response.status_code == 422
