"""会员权益注册表与 GET /api/entitlements 端点测试（19 项要求第 6 项）。"""

import pytest

from app.services.entitlements_registry import (
    EntitlementsRegistryError,
    REGISTRY_PATH,
    load_registry,
    validate_registry,
)

REQUIRED_TIERS = ("free", "pro", "team", "enterprise")
SIX_DIMENSIONS = ("quotas", "knowledge", "personalization", "export", "collaboration", "service")


class TestRegistryFile:
    def test_registry_file_loads_and_validates(self):
        registry = load_registry()
        assert registry["product"] == "新能源智库"
        assert registry["version"]
        for tier in REQUIRED_TIERS:
            assert tier in registry["tiers"], tier

    def test_every_tier_has_six_dimensions(self):
        registry = load_registry()
        for tier_id, tier in registry["tiers"].items():
            for dim in SIX_DIMENSIONS:
                assert dim in tier, f"{tier_id} 缺 {dim}"

    def test_validate_rejects_missing_tier(self):
        registry = load_registry()
        broken = {**registry, "tiers": {k: v for k, v in registry["tiers"].items() if k != "pro"}}
        with pytest.raises(EntitlementsRegistryError):
            validate_registry(broken)

    def test_validate_rejects_missing_dimension(self):
        registry = load_registry()
        broken_tier = {k: v for k, v in registry["tiers"]["free"].items() if k != "export"}
        broken = {**registry, "tiers": {**registry["tiers"], "free": broken_tier}}
        with pytest.raises(EntitlementsRegistryError):
            validate_registry(broken)

    def test_load_missing_file_fails_closed(self, tmp_path):
        load_registry.cache_clear()
        try:
            with pytest.raises(EntitlementsRegistryError):
                load_registry(tmp_path / "nope.json")
        finally:
            load_registry.cache_clear()


class TestEntitlementsEndpoint:
    @pytest.mark.asyncio
    async def test_get_entitlements_returns_registry(self, client):
        response = await client.get("/api/entitlements")
        assert response.status_code == 200
        body = response.json()
        assert body["product"] == "新能源智库"
        assert body["version"]
        for tier in REQUIRED_TIERS:
            assert tier in body["tiers"]
            for dim in SIX_DIMENSIONS:
                assert dim in body["tiers"][tier]

    @pytest.mark.asyncio
    async def test_endpoint_503_when_registry_unavailable(self, client, monkeypatch):
        from app.routers import entitlements as entitlements_router

        def _broken():
            raise EntitlementsRegistryError("registry missing")

        monkeypatch.setattr(entitlements_router, "load_registry", _broken)
        response = await client.get("/api/entitlements")
        assert response.status_code == 503
