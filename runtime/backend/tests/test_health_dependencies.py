"""生产健康检查必须看见数据库和 Redis，不能只返回静态 ok。"""
import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_health_reports_database_and_redis():
    # ASGITransport does not start/stop application lifespan automatically.
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
            response = await client.get("/health")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["database"] == "ok"
    assert body["redis"] in {"ok", "memory", "unavailable"}
    assert body["status"] == "ok"


@pytest.mark.asyncio
async def test_production_health_fails_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    class _Down:
        async def ping(self):
            raise ConnectionError("down")

    monkeypatch.setattr("app.redis_client.redis_client", _Down())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as http:
        response = await http.get("/health")
    assert response.status_code == 503
    body = response.json()
    assert body["database"] == "ok"
    assert body["redis"] == "unavailable"
    assert "down" not in response.text


@pytest.mark.asyncio
async def test_production_health_rejects_memory_redis(monkeypatch):
    from app.redis_client import _MemoryRedis

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr("app.redis_client.redis_client", _MemoryRedis())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as http:
        response = await http.get("/health")
    assert response.status_code == 503
    assert response.json()["redis"] == "unavailable"
