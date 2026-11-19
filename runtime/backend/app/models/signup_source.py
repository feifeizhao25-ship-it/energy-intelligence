"""国内版注册来源题「从哪知道我们」的记录表。

每个账号最多一条，只存九个枚举代码之一（没有自由文本）。user_id 只用于注销时删除；
对外只输出按代码的计数，从不和手机号、邮箱、姓名一起输出。
"""
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String

from app.models.database import Base


class SignupSourceEvent(Base):
    __tablename__ = "signup_source_events"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, unique=True, index=True)
    source = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("ix_signup_source_events_source_created_at", "source", "created_at"),)
