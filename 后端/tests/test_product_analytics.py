"""Production analytics evidence must be persisted, isolated and non-forgeable."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest


def _event(name: str = "analysis_completed") -> dict:
    return {
        "event_id": str(uuid4()),
        "event_name": name,
        "workspace_id": str(uuid4()),
        "locale": "en-US",
        "channel": "product",
        "campaign": "weekly-evidence",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "properties": {"source": "product"},
    }


@pytest.mark.asyncio
async def test_event_is_persisted_and_idempotent(client, auth_headers):
    payload = _event()
    first = await client.post("/api/v1/analytics/events", json=payload, headers=auth_headers)
    assert first.status_code == 201
    assert first.json()["persisted"] is True

    duplicate = await client.post(
        "/api/v1/analytics/events", json=payload, headers=auth_headers
    )
    assert duplicate.status_code == 201
    assert duplicate.json()["status"] == "duplicate"

    summary = await client.get("/api/v1/analytics/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["evidence_status"] == "verified_persisted_events"
    assert summary.json()["event_counts"] == {"analysis_completed": 1}


@pytest.mark.asyncio
async def test_empty_summary_does_not_invent_metrics(client, auth_headers):
    summary = await client.get("/api/v1/analytics/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["evidence_status"] == "no_verified_events"
    assert summary.json()["total_events"] == 0
    assert summary.json()["event_counts"] == {}


@pytest.mark.asyncio
async def test_client_cannot_forge_revenue_event(client, auth_headers):
    response = await client.post(
        "/api/v1/analytics/events",
        json=_event("payment_succeeded"),
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert "verified server-side webhook" in str(response.json())


@pytest.mark.asyncio
async def test_event_properties_reject_nested_secrets(client, auth_headers):
    payload = _event()
    payload["properties"] = {"context": {"access_token": "must-not-be-stored"}}
    response = await client.post(
        "/api/v1/analytics/events", json=payload, headers=auth_headers
    )
    assert response.status_code == 422
    assert "credentials or secrets" in str(response.json())


@pytest.mark.asyncio
async def test_analytics_requires_auth(client):
    assert (await client.post("/api/v1/analytics/events", json=_event())).status_code == 401
    assert (await client.get("/api/v1/analytics/summary")).status_code == 401
