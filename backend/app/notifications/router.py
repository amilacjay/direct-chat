"""Notifications router: list and mark-all-read."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Principal, get_current_user
from app.db.database import get_db
from app.db.models import Notification
from app.schemas import NotificationOut

router = APIRouter()


def _notification_to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        type=n.type,
        payload=n.payload,
        read=n.read,
        created_at=n.created_at,
    )


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all notifications for the current user, newest first."""
    user_id = uuid.UUID(principal.id)
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [_notification_to_out(n) for n in notifications]


@router.post("/read-all")
async def mark_all_read(
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    user_id = uuid.UUID(principal.id)
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.read.is_(False),
        )
    )
    notifications = result.scalars().all()
    for n in notifications:
        n.read = True
    await db.commit()
    return {"ok": True}
