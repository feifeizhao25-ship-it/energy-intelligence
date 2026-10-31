"""
Celery application configuration.
"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings
from app.ingestion.schedule import beat_entries


def _improvement_beat() -> dict:
    from app.services.continuous_improvement import schedule_kwargs

    spec = schedule_kwargs()
    if not spec.get("enabled"):
        return {}
    return {
        "continuous-improvement": {
            "task": "energy.domestic.continuous_improvement",
            "schedule": crontab(**spec["crontab"]),
        }
    }


def _sil_beat() -> dict:
    """每周自改进（SIL）。SIL_ENABLED 未打开时不登记，任务本身也会再检查一次。"""
    import os

    if str(os.environ.get("SIL_ENABLED", "0")).strip().lower() not in ("1", "true", "yes", "on"):
        return {}
    return {
        # 周日 03:00（上海）= 周六 19:00 UTC；与 05:00 的 NASA 批量、周一 03:00 的技能改进错开
        "self-improvement-weekly": {"task": "energy.domestic.self_improvement", "schedule": crontab(day_of_week=0, hour=3, minute=0)},
        # 每月 1 日 04:00（上海）库清点，只出降级名单
        "self-improvement-monthly": {"task": "energy.domestic.self_improvement_monthly", "schedule": crontab(day_of_month=1, hour=4, minute=0)},
    }


def _continuous_beat() -> dict:
    """持续改进：金标准评测 / 陈旧扫描 / 雷达暂存 / 月报。SIL_ENABLED 未打开时不登记，任务本身也会再检查一次。"""
    import os

    if str(os.environ.get("SIL_ENABLED", "0")).strip().lower() not in ("1", "true", "yes", "on"):
        return {}
    return {
        "stale-scan-daily": {"task": "energy.domestic.stale_scan", "schedule": crontab(hour=2, minute=30)},
        "golden-eval-weekly": {"task": "energy.domestic.golden_eval", "schedule": crontab(day_of_week=0, hour=3, minute=30)},
        "radar-weekly": {"task": "energy.domestic.radar", "schedule": crontab(day_of_week=3, hour=5, minute=0)},
        "radar-stage-weekly": {"task": "energy.domestic.radar_stage", "schedule": crontab(day_of_week=3, hour=6, minute=0)},
        "monthly-report": {"task": "energy.domestic.monthly_report", "schedule": crontab(day_of_month=1, hour=5, minute=0)},
    }


def _library_beat() -> dict:
    """资料库自动更新。LIBRARY_FRESHNESS_ENABLED 未打开时不登记，任务本身也会再检查一次。时间复用 SIL 的两个调度槽：daily_scan 每日 02:00、weekly_cycle 周日 03:00。"""
    import os

    if str(os.environ.get("LIBRARY_FRESHNESS_ENABLED", "0")).strip().lower() not in ("1", "true", "yes", "on"):
        return {}
    return {
        "library-check-daily": {"task": "energy.domestic.library_check", "schedule": crontab(hour=2, minute=0)},
        "library-discover-weekly": {"task": "energy.domestic.library_discover", "schedule": crontab(day_of_week=0, hour=3, minute=0)},
    }


celery_app = Celery(
    "energy",
    broker=settings.REDIS_URL.replace("redis://", "redis://"),
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.gdpr",
        "app.tasks.subscriptions",
        "app.tasks.domestic_loops",
        "app.tasks.public_ingestion",
        "app.tasks.continuous_improvement",
    ],
)

celery_app.conf.update(
    beat_schedule={
        "subscription-downgrades": {
            "task": "energy.subscriptions.apply_due_downgrades", "schedule": 60.0,
        },
        "skill-improvement-weekly": {
            "task": "energy.domestic.skill_improvement",
            "schedule": crontab(day_of_week=1, hour=3, minute=0),
        },
        "policy-snapshot-daily": {
            "task": "energy.domestic.policy_snapshot",
            "schedule": crontab(hour=2, minute=15),
        },
        "rag-refresh-daily": {
            "task": "energy.domestic.rag_refresh",
            "schedule": crontab(hour=2, minute=45),
        },
        "geo-monitor-weekly": {
            "task": "energy.domestic.geo_monitor",
            "schedule": crontab(day_of_week=1, hour=4, minute=0),
        },
        "wecom-reconcile": {
            "task": "energy.domestic.wecom_reconcile",
            "schedule": 900.0,
        },
        "nasa-batch-weekly": {
            "task": "energy.domestic.nasa_batch",
            "schedule": crontab(day_of_week=0, hour=5, minute=0),
        },
        **beat_entries(),
        **_improvement_beat(),
        **_sil_beat(),
        **_library_beat(),
        **_continuous_beat(),
    },
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # 定时表达式按 Asia/Shanghai 墙钟。enable_utc 仍为 True，Celery 会换算到 UTC。
    # UTC 对照：技能改进周一 03:00 CST = 周日 19:00 UTC；
    # 政策快照每日 02:15 CST = 前一日 18:15 UTC；
    # RAG 刷新每日 02:45 CST = 前一日 18:45 UTC；
    # GEO 周一 04:00 CST = 周日 20:00 UTC；
    # NASA 批量周日 05:00 CST = 周六 21:00 UTC。
    # 公开数据任务另表错峰，不占用 02:15 的省级门户抓取。总开关见 PUBLIC_INGESTION_ENABLED。
    # 持续改进默认每周一 03:30，与 03:20 文献抓取错开。可用 IMPROVEMENT_SCHEDULE 关闭。
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    result_expires=86400,   # Results expire after 24h
)

# include 要到 worker 启动才导入。这里显式导入，保证 beat 与进程内调用能登记任务名。
from app.tasks import public_ingestion as _public_ingestion  # noqa: E402,F401
from app.tasks import continuous_improvement as _continuous_improvement  # noqa: E402,F401
