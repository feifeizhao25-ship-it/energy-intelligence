"""访问与操作日志留存策略。演练记录待企业微信确认，不编造已完成。"""
from __future__ import annotations

RETENTION_DAYS = 183


def retention_policy() -> dict:
    return {
        "access_log_days": RETENTION_DAYS,
        "operation_log_days": RETENTION_DAYS,
        "basis": "网络安全法第二十一条，留存不少于六个月",
        "least_privilege": True,
        "backup_drill": {
            "status": "pending_wecom",
            "last_signed": None,
            "cadence": "每季 1 次",
        },
    }


def due_for_deletion(age_days: int) -> bool:
    return age_days > RETENTION_DAYS
