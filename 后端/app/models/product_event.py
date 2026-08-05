"""Persisted, tenant-scoped product events used for verified product analytics."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.types import JSON

from app.models.database import Base


class ProductEvent(Base):
    __tablename__ = "product_events"

    event_id = Column(String(36), primary_key=True)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    workspace_id = Column(String(36), nullable=True)
    event_name = Column(String(64), nullable=False)
    market = Column(String(10), nullable=False)
    locale = Column(String(20), nullable=False)
    channel = Column(String(64), nullable=True)
    campaign = Column(String(128), nullable=True)
    experiment = Column(String(128), nullable=True)
    properties = Column(JSON, nullable=False, default=dict)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    ingested_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_product_events_user_occurred", "user_id", "occurred_at"),
        Index("idx_product_events_name_occurred", "event_name", "occurred_at"),
    )
