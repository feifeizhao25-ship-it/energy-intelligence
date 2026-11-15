"""Backend rows for alert subscriptions and dataset download counts."""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from app.models.database import Base


class PolicyAlertSubscription(Base):
    __tablename__ = "policy_alert_subscriptions"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    province = Column(String(32), nullable=False)
    topic = Column(String(120), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DatasetDownload(Base):
    __tablename__ = "dataset_downloads"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    dataset_id = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
