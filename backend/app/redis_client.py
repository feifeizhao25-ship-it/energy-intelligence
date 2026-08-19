import json
import time
from typing import Any, Optional, List, Dict, Union
    def __init__(self) -> None:
        self._pool: Optional[redis.Redis] = None
        self._memory_cache: dict = {}
        self._memory_expiry: dict = {}
            logging.getLogger(__name__).warning(f"Redis连接失败,使用内存缓存: {e}")
            self._pool = None
            self._memory_cache = {}
            self._memory_expiry = {}
        if self._pool:
            await self._pool.close()
        self._memory_cache.clear()
        self._memory_expiry.clear()

    def _evict_if_expired(self, key: str) -> None:
        expires_at = self._memory_expiry.get(key)
        if expires_at is not None and expires_at <= time.time():
            self._memory_cache.pop(key, None)
            self._memory_expiry.pop(key, None)
        """获取字符串值"""
        if not self._pool:
            self._evict_if_expired(key)
            return self._memory_cache.get(key)
        return await self._pool.get(key)
        """设置字符串值"""
        if not self._pool:
            self._memory_cache[key] = value
            if expire is not None:
                self._memory_expiry[key] = time.time() + expire
            else:
                self._memory_expiry.pop(key, None)
            return True
        """删除键"""
        if not self._pool:
            if key in self._memory_cache:
                del self._memory_cache[key]
                self._memory_expiry.pop(key, None)
                return 1
            return 0
        """检查键是否存在"""
        if not self._pool:
            self._evict_if_expired(key)
            return key in self._memory_cache
        """设置过期时间"""
        if not self._pool:
            if key in self._memory_cache:
                self._memory_expiry[key] = time.time() + seconds
                return True
            return False
