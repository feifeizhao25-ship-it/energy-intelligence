"""Redis connection lifecycle with a development-only in-memory fallback."""

from __future__ import annotations

from typing import Any, Optional

import redis.asyncio as redis

from app.config import settings


class MockRedis:
    """Small async key/value substitute used only during local development."""

    def __init__(self) -> None:
        self._values: dict[str, Any] = {}

    async def get(self, key: str) -> Any:
        return self._values.get(key)

    async def set(self, key: str, value: Any, **_: Any) -> bool:
        self._values[key] = value
        return True

    async def delete(self, *keys: str) -> int:
        removed = sum(key in self._values for key in keys)
        for key in keys:
            self._values.pop(key, None)
        return removed

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        self._values.clear()


class RedisService:
    def __init__(self) -> None:
        self._redis: Optional[redis.Redis] = None
        self._mock: Optional[MockRedis] = None

    async def connect(self) -> None:
        try:
            client = redis.from_url(
                settings.REDIS_URL or "redis://localhost:6379/0",
                encoding="utf-8",
                decode_responses=True,
            )
            await client.ping()
            self._redis = client
        except Exception:
            self._redis = None
            if not settings.is_development:
                raise

    def client(self) -> redis.Redis | MockRedis:
        if self._redis is not None:
            return self._redis
        if not settings.is_development:
            raise RuntimeError(
                "Redis is not connected; in-memory fallback is disabled outside development"
            )
        if self._mock is None:
            self._mock = MockRedis()
        return self._mock

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None
        if self._mock is not None:
            await self._mock.close()
            self._mock = None


redis_service = RedisService()
