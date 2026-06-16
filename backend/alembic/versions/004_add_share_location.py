"""Add share_location column to users table.

Revision ID: 004_add_share_location
Revises: 003_add_albums
Create Date: 2026-06-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_add_share_location"
down_revision: Union[str, None] = "003_add_albums"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS share_location BOOLEAN NOT NULL DEFAULT false")


def downgrade() -> None:
    op.drop_column("users", "share_location")
