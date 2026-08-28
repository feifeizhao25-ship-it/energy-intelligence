"""Production operations endpoints must never expose generated telemetry as real data."""

import pytest
from fastapi import HTTPException

from app.api.v1 import operations


def test_operations_without_verified_source_are_always_rejected():
    with pytest.raises(HTTPException) as exc_info:
        operations._operations_source_unavailable()

    assert exc_info.value.status_code == 503
    assert "系统不会返回模拟健康分、告警、发电量或设备状态" in exc_info.value.detail


def test_production_module_contains_no_generated_telemetry_helper():
    assert not hasattr(operations, "_mock_health_data")
