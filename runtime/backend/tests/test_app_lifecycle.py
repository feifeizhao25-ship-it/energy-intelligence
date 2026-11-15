"""Connections must be released before the application's loop stops."""

from unittest.mock import AsyncMock

import pytest

from app.main import app, lifespan


@pytest.mark.asyncio
@pytest.mark.parametrize("body_fails", [False, True])
async def test_shutdown_releases_connections_even_when_body_raises(monkeypatch, body_fails):
    init = AsyncMock()
    database_close = AsyncMock()
    redis_close = AsyncMock()

    class Client:
        aclose = redis_close

    monkeypatch.setattr("app.main.init_db", init)
    monkeypatch.setattr("app.main.close_db", database_close)
    monkeypatch.setattr("app.redis_client.redis_client", Client())
    if body_fails:
        with pytest.raises(RuntimeError, match="application failure"):
            async with lifespan(app):
                raise RuntimeError("application failure")
    else:
        async with lifespan(app):
            redis_close.assert_not_awaited()
            database_close.assert_not_awaited()
    init.assert_awaited_once()
    redis_close.assert_awaited_once()
    database_close.assert_awaited_once()


@pytest.mark.asyncio
async def test_redis_shutdown_failure_still_closes_database(monkeypatch):
    database_close = AsyncMock()

    class Client:
        aclose = AsyncMock(side_effect=ConnectionError("closed transport"))

    monkeypatch.setattr("app.main.init_db", AsyncMock())
    monkeypatch.setattr("app.main.close_db", database_close)
    monkeypatch.setattr("app.redis_client.redis_client", Client())
    async with lifespan(app):
        pass
    database_close.assert_awaited_once()
