"""Store the service window covered by each paid order.

Revision ID: 0007_payment_order_period
Revises: 0006_user_token_version
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_payment_order_period"
down_revision: Union[str, None] = "0006_user_token_version"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payment_orders", sa.Column("period_start", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payment_orders", sa.Column("period_end", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("payment_orders", "period_end")
    op.drop_column("payment_orders", "period_start")
