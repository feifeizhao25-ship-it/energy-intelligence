"""
Canonical User model.

历史恢复碎片中本文件只剩重复的 property 定义；这里按测试与各路由的
真实使用面重建完整模型（phone/email 双登录标识、订阅与用量配额字段）。
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    # 登录标识：国内版用手机号，国际版用邮箱，二者均可为空但需唯一
    phone = Column(String(20), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    company = Column(String(200))
    role = Column(String(50), default="user")
    country = Column(String(100))
    market = Column(String(10), default="cn")  # cn | global
    stripe_customer_id = Column(String(255))
    subscription_plan = Column(String(50), default="free")
    usage_quota = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    projects = relationship("Project", back_populates="owner")

    @property
    def plan(self) -> str:
        """Public API alias for the canonical subscription_plan column."""
        return self.subscription_plan or "free"

    @plan.setter
    def plan(self, value: str) -> None:
        self.subscription_plan = value

    @property
    def full_name(self) -> str:
        """Public profile schema alias."""
        return self.name or ""
