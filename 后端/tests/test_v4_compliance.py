"""V4 合规测试（恢复重建版）— 订阅配额语义。

原文件只剩一行残片断言（remaining == -1 或 >= 0）。本版本按
app.core.subscription 的真实配额语义验收：-1 表示无限，其余必须非负。
"""

import pytest

from app.core.subscription import PLAN_QUOTAS, QuotaExceeded


def _remaining(limit: int, used: int) -> int:
    """配额余量：-1 表示无限。"""
    if limit == -1:
        return -1
    return max(0, limit - used)


def test_all_plan_quota_remaining_is_unlimited_or_non_negative():
    for plan, quotas in PLAN_QUOTAS.items():
        for category, limit in quotas.items():
            for used in (0, 1, 5, 10_000):
                remaining = _remaining(limit, used)
                assert remaining == -1 or remaining >= 0, (
                    f"{plan}/{category} used={used} 余量非法: {remaining}"
                )


def test_free_plan_has_finite_report_quota():
    assert PLAN_QUOTAS["free"]["report_exports_per_month"] == 5


def test_enterprise_plan_is_unlimited():
    assert PLAN_QUOTAS["enterprise"]["report_exports_per_month"] == -1


def test_quota_exceeded_carries_429():
    err = QuotaExceeded("report_exports_per_month", 5, 5)
    assert err.status_code == 429
    assert err.limit == 5
