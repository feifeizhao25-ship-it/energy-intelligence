"""Policy alert subscriptions and dataset download metering.

Revision ID: 0008_product_alerts
Revises: 0007_payment_order_period
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_product_alerts"
down_revision: Union[str, None] = "0007_payment_order_period"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "policy_alert_subscriptions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("province", sa.String(length=32), nullable=False),
        sa.Column("topic", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_policy_alert_user", "policy_alert_subscriptions", ["user_id"])
    op.create_table(
        "dataset_downloads",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("dataset_id", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_dataset_download_user", "dataset_downloads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_dataset_download_user", table_name="dataset_downloads")
    op.drop_table("dataset_downloads")
    op.drop_index("ix_policy_alert_user", table_name="policy_alert_subscriptions")
    op.drop_table("policy_alert_subscriptions")
