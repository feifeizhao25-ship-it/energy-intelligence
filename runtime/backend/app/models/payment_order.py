"""Persistent domestic payment orders used for verified membership activation."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String

from app.models.database import Base


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(String(36), primary_key=True)
    order_no = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(20), nullable=False, default="alipay")
    provider_trade_no = Column(String(128), nullable=True, unique=True)
    plan = Column(String(50), nullable=False)
    billing_period = Column(String(20), nullable=False)
    amount_cny = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    paid_at = Column(DateTime(timezone=True), nullable=True)

