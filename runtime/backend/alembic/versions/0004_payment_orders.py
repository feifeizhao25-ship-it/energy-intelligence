"""Add verified domestic payment orders.

Revision ID: 0004_payment_orders
Revises: 0003_report_compliance
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_payment_orders"
down_revision: Union[str, None] = "0003_report_compliance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_no", sa.String(64), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False, server_default="alipay"),
        sa.Column("provider_trade_no", sa.String(128), nullable=True),
        sa.Column("plan", sa.String(50), nullable=False),
        sa.Column("billing_period", sa.String(20), nullable=False),
        sa.Column("amount_cny", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("order_no", name="uq_payment_orders_order_no"),
        sa.UniqueConstraint("provider_trade_no", name="uq_payment_orders_provider_trade_no"),
    )
    op.create_index("ix_payment_orders_order_no", "payment_orders", ["order_no"])
    op.create_index("ix_payment_orders_user_id", "payment_orders", ["user_id"])
    op.create_index("ix_payment_orders_status", "payment_orders", ["status"])


def downgrade() -> None:
    op.drop_table("payment_orders")

