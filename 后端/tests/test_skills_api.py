"""Public Skills API route, auth and fail-closed execution tests."""

import pytest


@pytest.mark.asyncio
async def test_skills_api_requires_auth(client):
    assert (await client.get("/api/v1/skills")).status_code == 401
    assert (await client.post("/api/v1/skills/missing/execute", json={})).status_code == 401


@pytest.mark.asyncio
async def test_unknown_skill_returns_404(client, auth_headers):
    response = await client.post(
        "/api/v1/skills/not-a-real-skill/execute", json={}, headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_skills_catalog_is_live_not_a_static_placeholder(client, auth_headers):
    response = await client.get("/api/v1/skills", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == len(data["items"])
    assert data["total"] > 0
    assert all(item["skill_id"] and item["source_file"] for item in data["items"])


@pytest.mark.asyncio
async def test_async_execution_fails_closed_without_durable_queue(
    client, auth_headers, monkeypatch
):
    import app.routers.skills_executor as module

    class Registry:
        def get_meta(self, skill_id):
            return object()

    monkeypatch.setattr(module, "get_registry", lambda: Registry())
    response = await client.post(
        "/api/v1/skills/RA-001/execute?async=true", json={}, headers=auth_headers
    )
    assert response.status_code == 503
    assert "Durable asynchronous" in response.json()["detail"]
