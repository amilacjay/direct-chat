"""Add accent_hue to users table.

Revision ID: 002_add_accent_hue
Revises: 001_baseline
Create Date: 2026-06-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_add_accent_hue"
down_revision: Union[str, None] = "001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS makes this safe to run on DBs where the column was added
    # manually (e.g. via ALTER TABLE before Alembic was set up).
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_hue INTEGER DEFAULT NULL"
    )


def downgrade() -> None:
    op.drop_column("users", "accent_hue")
