"""共2：测试登录通道只在开发或测试构建里存在，正式构建的路由表里没有它。"""

import pytest
from fastapi import FastAPI

from app.services.dev_login_gate import is_test_login_enabled, mount_test_login


def _paths(app: FastAPI) -> set[str]:
    return set(app.openapi().get("paths", {}))


def test_production_does_not_mount_even_when_the_flag_is_on():
    app = FastAPI()
    assert is_test_login_enabled("production", "1") is False
    assert mount_test_login(app, "production", "1") is False
    assert "/api/v1/auth/test-login" not in _paths(app)


def test_flag_off_does_not_mount_in_development_or_test():
    for environment in ("development", "test"):
        app = FastAPI()
        assert is_test_login_enabled(environment, None) is False
        assert is_test_login_enabled(environment, "0") is False
        assert mount_test_login(app, environment, None) is False
        assert "/api/v1/auth/test-login" not in _paths(app)


def test_development_and_test_mount_only_when_flag_is_one():
    for environment in ("development", "test"):
        app = FastAPI()
        assert mount_test_login(app, environment, "1") is True
        assert "/api/v1/auth/test-login" in _paths(app)


@pytest.mark.asyncio
async def test_running_app_without_the_flag_has_no_test_login(client):
    response = await client.post("/api/v1/auth/test-login", json={"market": "global"})
    assert response.status_code == 404
