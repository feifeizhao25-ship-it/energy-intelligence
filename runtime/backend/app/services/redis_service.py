                self._redis = redis.from_url(
                    settings.REDIS_URL or "redis://localhost:6379/0",
                    encoding="utf-8",
                    decode_responses=True
                )
                await self._redis.ping()
            except Exception as e:
                self._redis = None
                if settings.is_development:
    def client(self):
        """获取Redis客户端"""
        if self._redis:
            return self._redis
        if self._mock is None:
            if not settings.is_development:
                raise RuntimeError(
                    "Redis is not connected; in-memory Redis fallback is disabled outside development"
                )
            self._mock = MockRedis()
        return self._mock