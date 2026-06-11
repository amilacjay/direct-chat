"""Add albums, album_images tables and chat-background columns on users.

Revision ID: 003_add_albums
Revises: 002_add_accent_hue
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_add_albums"
down_revision: Union[str, None] = "002_add_accent_hue"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if "albums" not in existing:
        op.create_table(
            "albums",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "user_id",
                sa.Uuid(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(length=60), nullable=False, server_default="Album"),
            sa.Column("cover_image_id", sa.Uuid(), nullable=True),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index("ix_albums_user_id", "albums", ["user_id"])

    if "album_images" not in existing:
        op.create_table(
            "album_images",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "album_id",
                sa.Uuid(),
                sa.ForeignKey("albums.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("object_key", sa.Text(), nullable=False),
            sa.Column("content_type", sa.String(length=40), nullable=False, server_default="image/jpeg"),
            sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index("ix_album_images_album_id", "album_images", ["album_id"])

    # New user columns — IF NOT EXISTS so this is safe on DBs already patched.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_background_key TEXT DEFAULT NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_background_size INTEGER NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.drop_column("users", "chat_background_size")
    op.drop_column("users", "chat_background_key")
    op.drop_index("ix_album_images_album_id", table_name="album_images")
    op.drop_table("album_images")
    op.drop_index("ix_albums_user_id", table_name="albums")
    op.drop_table("albums")
