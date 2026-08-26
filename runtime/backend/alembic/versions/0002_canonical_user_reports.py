"""Canonical user columns + reports/cashflow tables

Revision ID: 0002_canonical_user_reports
Revises: 0001_initial_schema
Create Date: 2026-07-27 00:00:00.000000

变更说明：
- users 表对齐 app.models.user 的 canonical 定义：phone（唯一、可空）、
  market、subscription_plan（由旧 plan 列迁移数据）、usage_quota(JSON)。
  旧 plan 列保留只读兼容（模型层 plan 是 subscription_plan 的别名属性）。
- 新增 reports、 cashflow_projections 两张表（app.models.report/cashflow）。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_canonical_user_reports"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: canonical columns ──────────────────────────────────────────────
    op.add_column("users", sa.Column("phone", sa.String(20), nullable=True))
    op.create_index("idx_users_phone", "users", ["phone"], unique=True)
    op.add_column("users", sa.Column("market", sa.String(10), nullable=False, server_default="cn"))
    op.add_column("users", sa.Column("subscription_plan", sa.String(50), nullable=False, server_default="free"))
    op.add_column("users", sa.Column("usage_quota", sa.JSON, nullable=True))
    # 旧 plan 列数据迁移到 subscription_plan（保留旧列以兼容历史读取方）
    op.execute("UPDATE users SET subscription_plan = plan WHERE plan IS NOT NULL")
    # email 放宽为可空（国内版手机号注册无邮箱）
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=True)

    # ── reports ───────────────────────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="zh"),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("file_path", sa.String(512), nullable=True),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_reports_project", "reports", ["project_id"])
    op.create_index("idx_reports_user", "reports", ["user_id"])

    # ── cashflow_projections ──────────────────────────────────────────────────
    op.create_table(
        "cashflow_projections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("scenario_name", sa.String(255), nullable=True),
        sa.Column("yearly_cashflows", sa.JSON, nullable=True),
        sa.Column("irr", sa.Float, nullable=True),
        sa.Column("npv", sa.Float, nullable=True),
        sa.Column("lcoe", sa.Float, nullable=True),
        sa.Column("payback_years", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_cashflow_project", "cashflow_projections", ["project_id"])


def downgrade() -> None:
    op.drop_table("cashflow_projections")
    op.drop_table("reports")
    op.alter_column("users", "email", existing_type=sa.String(255), nullable=False)
    op.drop_column("users", "usage_quota")
    op.drop_column("users", "subscription_plan")
    op.drop_column("users", "market")
    op.drop_index("idx_users_phone", table_name="users")
    op.drop_column("users", "phone")
