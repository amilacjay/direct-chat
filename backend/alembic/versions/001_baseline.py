"""Baseline — represents the schema that existed before Alembic was introduced.

Existing databases should be stamped with this revision before upgrading:
    alembic stamp 001_baseline

New databases get all migrations applied in order from here.

Revision ID: 001_baseline
Revises:
Create Date: 2026-06-06
"""
from typing import Sequence, Union

revision: str = "001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables (users, friendships, notifications) were created by SQLAlchemy
    # create_all before Alembic was introduced. Nothing to do here.
    pass


def downgrade() -> None:
    pass
