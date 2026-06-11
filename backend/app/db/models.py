"""SQLAlchemy ORM models. Only profiles/friends/notifications are persisted.

Message content is NEVER stored here by design.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

# Portable column types: native on Postgres (prod), generic on SQLite (tests/lite).
UUIDType = Uuid(as_uuid=True)
JSONType = JSON().with_variant(JSONB, "postgresql")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, primary_key=True, default=uuid.uuid4
    )
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(String(300), nullable=True)
    location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # DOB is stored encrypted at the application layer (string ciphertext).
    dob_encrypted: Mapped[str] = mapped_column(Text)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    show_gender: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')
    show_age: Mapped[bool] = mapped_column(Boolean, default=True, server_default='true')
    appear_online: Mapped[bool] = mapped_column(Boolean, default=True)
    accent_hue: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Chat background shown to friends. `key` is a media object key (see storage
    # save_media); `size` is 0 when the key points at an existing album image
    # (shared object, not double-counted toward the user's quota).
    chat_background_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    chat_background_size: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        CheckConstraint(
            "status IN ('pending','accepted','blocked')", name="ck_friendship_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, primary_key=True, default=uuid.uuid4
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    addressee_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(60), default="Album")
    # Selectable thumbnail; nullable FK (no DB-level FK to avoid a circular
    # dependency with album_images — validated in the router instead).
    cover_image_id: Mapped[uuid.UUID | None] = mapped_column(UUIDType, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    images: Mapped[list["AlbumImage"]] = relationship(
        back_populates="album",
        cascade="all, delete-orphan",
        order_by="AlbumImage.position",
    )


class AlbumImage(Base):
    __tablename__ = "album_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, primary_key=True, default=uuid.uuid4
    )
    album_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("albums.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(Text)
    content_type: Mapped[str] = mapped_column(String(40), default="image/jpeg")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    album: Mapped["Album"] = relationship(back_populates="images")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
