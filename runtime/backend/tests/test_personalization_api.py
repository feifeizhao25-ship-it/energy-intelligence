import pytest


@pytest.mark.asyncio
async def test_demo_personalization_contract_is_public_and_disclosed(client):
    response = await client.get(
        "/api/v1/personalization/daily-layout",
        params={"persona_id": "chen_xin", "day": 7},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["data"]["day"] == 7
    assert body["data"]["hero"]["evidence_status"] == "demo"
    assert "演示数据" in body["data"]["hero"]["evidence_note"]


@pytest.mark.asyncio
async def test_demo_personalization_rejects_unknown_persona(client):
    response = await client.get(
        "/api/v1/personalization/daily-layout",
        params={"persona_id": "unknown", "day": 1},
    )
    assert response.status_code == 404

