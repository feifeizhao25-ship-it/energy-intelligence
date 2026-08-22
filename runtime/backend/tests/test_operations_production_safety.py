"""Production operations endpoints must never expose generated telemetry as real data."""

import pytest
from fastapi import HTTPException

from app.api.v1 import operations


def test_demo_operations_data_is_rejected_in_production(monkeypatch):
    monkeypatch.setattr(operations.settings, "ENVIRONMENT", "production")

    with pytest.raises(HTTPException) as exc_info:
        operations._reject_demo_operations_data_in_production()

    assert exc_info.value.status_code == 503
    assert "不会在生产环境返回模拟数据" in exc_info.value.detail


def test_demo_operations_data_remains_available_for_local_development(monkeypatch):
    monkeypatch.setattr(operations.settings, "ENVIRONMENT", "development")

    operations._reject_demo_operations_data_in_production()
