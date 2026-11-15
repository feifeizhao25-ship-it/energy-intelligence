"""持续改进定时任务。开关关闭时直接返回，不访问网络。"""
from __future__ import annotations

import os

from app.tasks.celery_app import celery_app


@celery_app.task(name="energy.domestic.continuous_improvement")
def continuous_improvement() -> dict:
    if (os.environ.get("IMPROVEMENT_ENABLED") or "1").strip() == "0":
        return {"status": "noop", "reason": "未开启", "applied": False}
    from app.services.continuous_improvement import run_cycle
    return run_cycle()
