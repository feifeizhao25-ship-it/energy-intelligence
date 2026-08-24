"""Production storage must follow the isolated market deployment."""

import pytest


def test_global_production_requires_s3(monkeypatch):
    import app.services.storage_service as module

    monkeypatch.setattr(module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(module.settings, "MARKET_REGION", "global")
    monkeypatch.setenv("STORAGE_PROVIDER", "oss")
    with pytest.raises(RuntimeError, match="must be s3"):
        module.StorageService()


def test_cn_production_requires_oss(monkeypatch):
    import app.services.storage_service as module

    monkeypatch.setattr(module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(module.settings, "MARKET_REGION", "cn")
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    with pytest.raises(RuntimeError, match="must be oss"):
        module.StorageService()


def test_global_s3_contract_accepts_role_based_credentials(monkeypatch):
    import app.services.storage_service as module

    monkeypatch.setattr(module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(module.settings, "MARKET_REGION", "global")
    monkeypatch.setenv("STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_BUCKET", "energy-global-private")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    service = module.StorageService()
    assert service.provider == "s3"
