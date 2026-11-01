"""Add projects.country_code (additive, nullable) and backfill it from the free-text address.

Reports used to default the country to CN because the project had no country at all (retest B16). The column is
nullable and nothing is defaulted: a row whose address does not name a country stays NULL, and the report says the
country is not recorded.

Revision ID: 0010_project_country_code
Revises: 0009_feedback_samples
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_project_country_code"
down_revision: Union[str, None] = "0009_feedback_samples"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("country_code", sa.String(length=2), nullable=True))

    from app.services.geo_hint import infer_country

    bind = op.get_bind()
    projects = sa.table("projects", sa.column("id", sa.String), sa.column("location", sa.String), sa.column("country_code", sa.String))
    for row in bind.execute(sa.select(projects.c.id, projects.c.location).where(projects.c.country_code.is_(None))).fetchall():
        code = infer_country(row.location)
        if code:
            bind.execute(sa.update(projects).where(projects.c.id == row.id).values(country_code=code))


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("country_code")
