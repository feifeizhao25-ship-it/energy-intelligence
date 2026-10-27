"""
Celery application configuration.
"""
from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "energy",
    broker=settings.REDIS_URL.replace("redis://", "redis://"),
    backend=settings.REDIS_URL,
    include=["app.tasks.gdpr", "app.tasks.subscriptions", "app.tasks.domestic_loops"],
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
    },
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    result_expires=86400,   # Results expire after 24h
)
