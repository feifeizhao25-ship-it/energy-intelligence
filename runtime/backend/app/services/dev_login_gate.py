"""开发/测试专用登录通道的开关。

正式环境（ENVIRONMENT=production）一律不挂载，即使 TEST_LOGIN_ENABLED=1。
默认关闭：开发或测试环境还要显式把 TEST_LOGIN_ENABLED 设为 1 才挂载。
"""

from __future__ import annotations

import os

from fastapi import FastAPI

_OPEN_ENVIRONMENTS = frozenset({"development", "test"})


def is_test_login_enabled(environment: str | None, flag: str | None) -> bool:
    if (environment or "").strip().lower() not in _OPEN_ENVIRONMENTS:
        return False
    return (flag or "").strip() == "1"


def mount_test_login(app: FastAPI, environment: str | None, flag: str | None) -> bool:
    """挂载则返回 True。正式构建的 OpenAPI 里没有这条路径。"""
    if not is_test_login_enabled(environment, flag):
        return False
    from app.api.v1.dev_login import router as test_login_router

    app.include_router(test_login_router, prefix="/api/v1", tags=["test-login"])
    return True


def mount_test_login_from_process(app: FastAPI, environment: str | None) -> bool:
    return mount_test_login(app, environment, os.getenv("TEST_LOGIN_ENABLED"))
