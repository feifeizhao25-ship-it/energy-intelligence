"""Report compliance columns

Revision ID: 0003_report_compliance
Revises: 0002_canonical_user_reports
Create Date: 2026-07-27 00:00:00.000000

变更说明：
- reports 表新增合规列（对齐 app.models.report，运营资料硬要求）：
  data_sources(JSON, 数据溯源)、is_premium(Boolean)、
  reviewed(人工终审标记)、reviewed_by(终审人, 可空)。
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_report_compliance"
down_revision: Union[str, None] = "0002_canonical_user_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("data_sources", sa.JSON, nullable=True))
    op.add_column(
        "reports",
        sa.Column("is_premium", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "reports",
        sa.Column("reviewed", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.add_column("reports", sa.Column("reviewed_by", sa.String(36), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "reviewed_by")
    op.drop_column("reports", "reviewed")
    op.drop_column("reports", "is_premium")
    op.drop_column("reports", "data_sources")
