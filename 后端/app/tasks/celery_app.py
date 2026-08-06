"""
Celery application configuration.
"""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "energy",
    broker=settings.REDIS_URL.replace("redis://", "redis://"),
    backend=settings.REDIS_URL,
    include=["app.tasks.gdpr"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    result_expires=86400,   # Results expire after 24h
)
