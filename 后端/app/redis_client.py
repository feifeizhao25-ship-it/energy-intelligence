"""
Redis client with an in-memory fallback.

生产环境通过 REDIS_URL 连接真实 Redis；连接不可用（或测试环境未配置）时
退化为进程内字典实现，接口保持 asyncio-redis 子集兼容，保证限流/防爆破
等逻辑在任何环境都能工作（单 worker 前提下语义一致）。
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class _MemoryPipeline:
    def __init__(self, client: "_MemoryRedis") -> None:
        self._client = client
        self._ops: list = []

    def incr(self, key: str) -> "_MemoryPipeline":
        self._ops.append(("incr", key))
        return self

    def expire(self, key: str, seconds: int) -> "_MemoryPipeline":
        self._ops.append(("expire", key, seconds))
        return self

    async def execute(self) -> list:
        results = []
        for op in self._ops:
            if op[0] == "incr":
                results.append(await self._client.incr(op[1]))
            elif op[0] == "expire":
                results.append(await self._client.expire(op[1], op[2]))
        self._ops.clear()
        return results


class _MemoryRedis:
    """asyncio-redis 子集的进程内实现。"""

    def __init__(self) -> None:
        self._store: Dict[str, Any] = {}
        self._expires: Dict[str, float] = {}

    def _purge(self, key: str) -> None:
        exp = self._expires.get(key)
        if exp is not None and exp < time.time():
            self._store.pop(key, None)
            self._expires.pop(key, None)

    async def get(self, key: str) -> Optional[str]:
        self._purge(key)
        value = self._store.get(key)
        return None if value is None else str(value)

    async def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        self._store[key] = value
        if ex is not None:
            self._expires[key] = time.time() + ex
        return True

    async def incr(self, key: str) -> int:
        self._purge(key)
        self._store[key] = int(self._store.get(key, 0)) + 1
        return self._store[key]

    async def expire(self, key: str, seconds: int) -> bool:
        self._expires[key] = time.time() + seconds
        return True

    async def delete(self, *keys: str) -> int:
        removed = 0
        for key in keys:
            removed += 1 if self._store.pop(key, None) is not None else 0
            self._expires.pop(key, None)
        return removed

    def pipeline(self) -> _MemoryPipeline:
        return _MemoryPipeline(self)

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:  # 兼容真实 client 的关闭接口
        self._store.clear()
        self._expires.clear()


def _build_client():
    import os

    from app.config import settings

    # 测试模式且未显式指定 REDIS_URL 时强制内存版：单测不应依赖本机 Redis。
    if os.environ.get("ENERGY_TEST_MODE") == "1" and "REDIS_URL" not in os.environ:
        logger.info("测试模式未显式配置 REDIS_URL，使用内存版 redis_client")
        return _MemoryRedis()

    redis_url = getattr(settings, "REDIS_URL", None)
    if not redis_url:
        logger.info("REDIS_URL 未配置，使用内存版 redis_client")
        return _MemoryRedis()
    try:
        import redis.asyncio as aioredis

        return aioredis.from_url(redis_url, decode_responses=True)
    except Exception as exc:  # pragma: no cover - 依赖缺失时兜底
        logger.warning("Redis 初始化失败 (%s)，使用内存版 redis_client", exc)
        return _MemoryRedis()


redis_client = _build_client()
