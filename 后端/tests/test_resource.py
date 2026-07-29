"""
Tests for resource assessment endpoints and services.
Run with: pytest tests/test_resource.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.resource_service import _classify_solar, _classify_wind


# ── Solar classification (GHI thresholds: I>2000, II 1600-2000, III 1200-1600, IV<1200) ──
class TestSolarClassification:
    def test_class_I(self):
        assert _classify_solar(2200)[0] == "I"

    def test_class_I_boundary(self):
        assert _classify_solar(2000.1)[0] == "I"

    def test_class_II(self):
        assert _classify_solar(1800)[0] == "II"

    def test_class_II_lower_boundary(self):
        assert _classify_solar(1600)[0] == "II"

    def test_class_III(self):
        assert _classify_solar(1400)[0] == "III"

    def test_class_IV(self):
        assert _classify_solar(1100)[0] == "IV"
        assert _classify_solar(500)[0]  == "IV"
        assert _classify_solar(1199)[0] == "IV"


# ── Wind classification (WPD thresholds: I>400, II 300-400, III 200-300, IV<200 W/m²) ──
class TestWindClassification:
    def test_class_I(self):
        assert _classify_wind(450)[0] == "I"    # WPD > 400 W/m²

    def test_class_II(self):
        assert _classify_wind(350)[0] == "II"   # WPD 300–400

    def test_class_III(self):
        assert _classify_wind(250)[0] == "III"  # WPD 200–300

    def test_class_IV(self):
        assert _classify_wind(150)[0] == "IV"   # WPD < 200


# ── Health check ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "environment" in data


# ── Auth guard tests ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_solar_resource_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/resource/solar", json={"lat": 36.1, "lng": -115.1})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wind_resource_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/resource/wind", json={"lat": 36.1, "lng": -115.1})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_projects_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/projects")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_research_papers_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/research/papers?q=solar")
        assert resp.status_code == 401


# ── Input validation ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_solar_resource_invalid_lat():
    """Latitude outside [-90, 90] should return 422 (validation) or 401 (no token)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/resource/solar",
            json={"lat": 999.0, "lng": -115.1},
        )
        assert resp.status_code in (401, 422)


@pytest.mark.asyncio
async def test_solar_resource_invalid_lng():
    """Longitude outside [-180, 180] should return 422 or 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/resource/solar",
            json={"lat": 36.1, "lng": 999.0},
        )
        assert resp.status_code in (401, 422)


# ── Research contract ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_research_trends_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/research/trends?metric=lcoe_solar")
        assert resp.status_code == 401
