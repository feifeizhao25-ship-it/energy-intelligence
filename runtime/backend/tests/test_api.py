"""Mounted API contract for auth, projects, resource checks, and finance.

The live file used to call whatever was listening on port 8000 and expected a
bare token. The mounted routes return the shared envelope from
``app.utils.response.success`` for auth and projects (see
``app.routers.projects`` and ``tests/test_domestic_gaps_20261027.py``).
Finance and resource responses stay the pydantic models, not that envelope.
Resource lookups are stubbed so this does not call NASA or Open-Meteo.
"""
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1 import resource as resource_api
from app.main import app
from app.schemas.resource import SolarResourceResponse, WindResourceResponse

pytestmark = pytest.mark.asyncio


async def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _register(client: AsyncClient, prefix: str = "pytest") -> str:
    email = f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/api/v1/auth/register", json={
        "name": "Pytest User",
        "email": email,
        "password": "Test1234!",
        "company": "Pytest Corp",
        "role": "developer",
    })
    assert response.status_code == 201, response.text
    body = response.json()
    token = body["data"]["access_token"]
    refresh = body["data"]["refresh_token"]
    assert token and refresh and body["data"]["token_type"] == "bearer"
    assert "access_token" not in body
    return token


async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_register_returns_tokens_inside_the_envelope(client):
    await _register(client)


async def test_register_duplicate_is_conflict(client):
    email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
    payload = {"name": "Dup", "email": email, "password": "Test1234!"}
    assert (await client.post("/api/v1/auth/register", json=payload)).status_code == 201
    again = await client.post("/api/v1/auth/register", json=payload)
    assert again.status_code == 409


async def test_login_success_and_wrong_password(client):
    email = f"login_{uuid.uuid4().hex[:8]}@test.com"
    assert (await client.post("/api/v1/auth/register", json={
        "name": "Login", "email": email, "password": "Test1234!",
    })).status_code == 201
    ok = await client.post("/api/v1/auth/login", json={"email": email, "password": "Test1234!"})
    assert ok.status_code == 200
    assert ok.json()["data"]["access_token"]
    bad = await client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword!"})
    assert bad.status_code == 401
    missing = await client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "Test1234!"})
    assert missing.status_code == 401


async def test_projects_are_private_to_the_owner(client):
    owner = await _register(client, "proj")
    stranger = await _register(client, "other")
    empty = await client.get("/api/v1/projects", headers={"Authorization": f"Bearer {owner}"})
    assert empty.status_code == 200
    assert empty.json()["data"] == []
    created = await client.post("/api/v1/projects", headers={"Authorization": f"Bearer {owner}"}, json={
        "name": "格尔木光伏电站",
        "technology": "solar",
        "capacity_kw": 100000,
        "location": {"latitude": 36.42, "longitude": 94.91, "address": "格尔木"},
        "description": "pytest test project",
    })
    assert created.status_code == 201, created.text
    project = created.json()["data"]
    assert project["name"] == "格尔木光伏电站"
    assert project["technology"] == "solar"
    assert project["capacity_kw"] == 100000
    fetched = await client.get(f"/api/v1/projects/{project['id']}", headers={"Authorization": f"Bearer {owner}"})
    assert fetched.status_code == 200
    assert fetched.json()["data"]["name"] == "格尔木光伏电站"
    hidden = await client.get(f"/api/v1/projects/{project['id']}", headers={"Authorization": f"Bearer {stranger}"})
    assert hidden.status_code == 404
    assert (await client.get("/api/v1/projects")).status_code == 401


async def test_resource_validation_and_stubbed_lookup(client, monkeypatch):
    token = await _register(client, "res")
    headers = {"Authorization": f"Bearer {token}"}

    async def solar(body):
        return SolarResourceResponse(
            lat=body.lat, lng=body.lng, ghi=1456, dni=1, dhi=1, peak_sun_hours=4,
            optimal_tilt=30, avg_temperature=10, resource_class="III", score=40,
            data_source="fixture", monthly_ghi=[1.0] * 12,
        )

    async def wind(body):
        return WindResourceResponse(
            lat=body.lat, lng=body.lng, mean_speed=6.5, wind_power_density=250,
            weibull_k=2, weibull_c=7, turbulence_intensity=0.1,
            resource_class="III", score=40, monthly_speed=[6.0] * 12,
        )

    monkeypatch.setattr(resource_api, "fetch_solar_resource", solar)
    monkeypatch.setattr(resource_api, "fetch_wind_resource", wind)
    solar_response = await client.post("/api/v1/resource/solar", headers=headers, json={"lat": 36.42, "lng": 94.91})
    assert solar_response.status_code == 200, solar_response.text
    assert solar_response.json()["ghi"] == 1456
    wind_response = await client.post("/api/v1/resource/wind", headers=headers, json={"lat": 36.42, "lng": 94.91})
    assert wind_response.status_code == 200, wind_response.text
    assert "mean_speed" in wind_response.json()
    missing = await client.post("/api/v1/resource/solar", headers=headers, json={"lat": 36.42})
    assert missing.status_code == 422


async def test_finance_solar_and_wind_return_the_model(client):
    token = await _register(client, "fin")
    headers = {"Authorization": f"Bearer {token}"}
    solar = await client.post("/api/v1/finance/solar", headers=headers, json={
        "capacity_mw": 100, "capex_per_w": 4.85, "opex_per_kw_yr": 287.5,
        "electricity_price": 0.35, "ghi_annual": 1456, "capacity_factor": 0.18,
    })
    assert solar.status_code == 200, solar.text
    assert "irr" in solar.json() and "lcoe" in solar.json()
    wind = await client.post("/api/v1/finance/wind", headers=headers, json={
        "capacity_mw": 100, "capex_per_kw": 9800, "opex_per_kw_yr": 287.5,
        "electricity_price": 350, "wind_capacity_factor": 0.35,
    })
    assert wind.status_code == 200, wind.text
    body = wind.json()
    assert "irr" in body or "lcoe" in body
