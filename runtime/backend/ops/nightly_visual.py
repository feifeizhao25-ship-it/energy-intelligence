"""夜间界面巡检的汇报结构。不在这里启动浏览器。

企业微信未配置时不外发。失败项只记录路径，不伪造差异图。
"""
from __future__ import annotations


def build_report(users: list[str], pages: int, failures: list[dict] | None = None) -> dict:
    failures = failures or []
    return {
        "schedule": "01:00",
        "users": users,
        "pages_per_user": pages,
        "collage_pages": 7,
        "status": "failed" if failures else "ready",
        "failures": failures,
        "sent": False,
        "approval": "wecom",
    }
