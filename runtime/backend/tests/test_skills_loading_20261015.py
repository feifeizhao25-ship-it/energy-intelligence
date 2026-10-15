"""技能在生产镜像布局下可加载；/api/v1/skills 已挂载；param_adapter 导入正确。"""
import importlib
import shutil

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.skills import registry as reg


def _fresh_registry(monkeypatch, services_dir):
    monkeypatch.setenv("SKILLS_SERVICES_DIR", str(services_dir))
    mod = importlib.reload(reg)
    r = mod.SkillRegistry()
    return mod, r.discover_all(force=True), r


def test_repo_layout_loads_skills():
    r = reg.SkillRegistry()
    assert r.discover_all(force=True) >= 7


def test_container_like_layout_loads_skills(tmp_path, monkeypatch):
    # 模拟镜像：/app/app/skills/registry.py + /app/services/*（parents[3] = / 时不再依赖仓库根）
    repo_services = reg._SERVICES_DIR
    target = tmp_path / "app" / "services"
    shutil.copytree(repo_services, target, ignore=shutil.ignore_patterns("__pycache__", ".venv", "node_modules"))
    mod, count, r = _fresh_registry(monkeypatch, target)
    try:
        assert mod._SERVICES_DIR == target.resolve()
        assert count >= 7
        assert "CA-001" in r._skills and "RA-001" in r._skills
    finally:
        monkeypatch.delenv("SKILLS_SERVICES_DIR")
        importlib.reload(reg)


def test_missing_services_dir_registers_zero(tmp_path, monkeypatch):
    mod, count, _ = _fresh_registry(monkeypatch, tmp_path / "nope")
    try:
        assert count == 0
    finally:
        monkeypatch.delenv("SKILLS_SERVICES_DIR")
        importlib.reload(reg)


def test_executor_uses_existing_param_adapter():
    import inspect
    from app.routers import skills_executor
    src = inspect.getsource(skills_executor)
    assert "app.skills.param_adapter_v2 import adapt_params" in src
    assert "from app.skills.param_adapter import" not in src
    importlib.import_module("app.skills.param_adapter_v2").adapt_params("CA-001", {"annual_generation_mwh": 1})


@pytest.mark.asyncio
async def test_skills_router_is_mounted():
    # 新版 FastAPI 的 include_router 为惰性 _IncludedRouter，app.routes 不展开路径；以 OpenAPI 为准
    paths = set(app.openapi()["paths"].keys())
    assert "/api/v1/skills" in paths
    assert "/api/v1/skills/{skill_id}/execute" in paths


@pytest.mark.asyncio
async def test_health_fails_when_skills_below_minimum(monkeypatch):
    monkeypatch.setenv("SKILLS_MIN_COUNT", "999")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        resp = await c.get("/health")
    assert resp.status_code == 503
    monkeypatch.setenv("SKILLS_MIN_COUNT", "1")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        resp = await c.get("/health")
    assert resp.status_code == 200 and resp.json()["skills_loaded"] >= 1
