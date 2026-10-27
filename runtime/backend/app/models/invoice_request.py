"""开票申请。没有税控密钥时只登记待人工处理，不编造发票号。"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.models.database import Base


class InvoiceRequest(Base):
    __tablename__ = "invoice_requests"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    order_no = Column(String(64), nullable=False)
    title = Column(String(200), nullable=False)
    tax_no = Column(String(40))
    status = Column(String(30), nullable=False, default="pending_manual")
    invoice_no = Column(String(64))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
