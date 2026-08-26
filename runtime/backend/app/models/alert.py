"""用户级提醒规则模型（alerts API 落库）。

⚠️ 镜像同步：app/models 的任何改动必须同步到 runtime/backend/app/models
（rsync 单文件），并在 runtime/backend 跑 `.runtime-venv/bin/python -m pytest tests -q`
验证（基线 239 passed）。
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String

from app.models.database import Base


class AlertRule(Base):
    """用户级政策提醒规则：关联 RAG 注册表政策条目，impact_score 超阈值触发。"""

    __tablename__ = "alert_rules"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    # RAG 注册表条目（type=policy/standard），评估时调 KA-070
    source_id = Column(String(100), nullable=False)
    threshold = Column(Float, default=0.7, nullable=False)  # 与 KA-070 ALERT_THRESHOLD 一致
    enabled = Column(Boolean, default=True, nullable=False)
    last_impact_score = Column(Float)
    last_evaluated_at = Column(DateTime(timezone=True))
    last_triggered_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
