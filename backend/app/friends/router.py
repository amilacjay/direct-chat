"""Friends router: friend requests, acceptance, blocking, listing."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Principal, get_current_user
from app.db.database import get_db
from app.db.models import Friendship, Notification, User
from app.kafka.bus import TOPIC_NOTIFICATIONS, publish
from app.schemas import Friend, FriendRequest, NotificationOut, PublicUser
from app.ws.hub import manager

router = APIRouter()


def _user_to_public(user: User) -> PublicUser:
    return PublicUser(
        id=str(user.id),
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        location=user.location,
        is_guest=False,
        created_at=user.created_at,
    )


def _notification_to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        type=n.type,
        payload=n.payload,
        read=n.read,
        created_at=n.created_at,
    )


async def are_friends(db: AsyncSession, a_id: str, b_id: str) -> bool:
    """True if there's an accepted friendship between a and b (either direction).

    Used by the albums router to gate friends-only media. Returns False for any
    non-UUID id (e.g. guest ids), which never have DB friendships.
    """
    if a_id == b_id:
        return True
    try:
        a = uuid.UUID(a_id)
        b = uuid.UUID(b_id)
    except (ValueError, TypeError):
        return False
    result = await db.execute(
        select(Friendship.id).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.requester_id == a, Friendship.addressee_id == b),
                and_(Friendship.requester_id == b, Friendship.addressee_id == a),
            ),
        )
    )
    return result.first() is not None


async def _get_user_by_id(db: AsyncSession, user_id: str) -> User:
    """Resolve a user_id string to a User or raise 404."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _push_notification(
    db: AsyncSession,
    target_user_id: uuid.UUID,
    notif_type: str,
    payload: dict,
) -> Notification:
    """Create a DB notification, push via WS, publish to Kafka."""
    notif = Notification(
        user_id=target_user_id,
        type=notif_type,
        payload=payload,
    )
    db.add(notif)
    await db.flush()  # assigns id/created_at

    notif_out = _notification_to_out(notif)
    notif_dict = notif_out.model_dump(mode="json")

    await manager.send_to(
        str(target_user_id),
        {"type": "notification", "data": notif_dict},
    )
    await publish(TOPIC_NOTIFICATIONS, {"type": "notification", "data": notif_dict})
    return notif


# ---- List endpoints (no path params) ----

@router.get("", response_model=list[Friend])
async def list_friends(
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all accepted friends for the current user."""
    me_id = uuid.UUID(principal.id)

    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                Friendship.requester_id == me_id,
                Friendship.addressee_id == me_id,
            ),
        )
    )
    friendships = result.scalars().all()

    friends: list[Friend] = []
    for fs in friendships:
        other_id = fs.addressee_id if fs.requester_id == me_id else fs.requester_id
        user_result = await db.execute(select(User).where(User.id == other_id))
        other_user = user_result.scalar_one_or_none()
        if other_user is None:
            continue
        friends.append(
            Friend(
                user=_user_to_public(other_user),
                friendship_id=str(fs.id),
            )
        )
    return friends


@router.get("/requests", response_model=list[FriendRequest])
async def list_friend_requests(
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List incoming pending friend requests for the current user."""
    me_id = uuid.UUID(principal.id)

    result = await db.execute(
        select(Friendship).where(
            Friendship.addressee_id == me_id,
            Friendship.status == "pending",
        )
    )
    friendships = result.scalars().all()

    requests: list[FriendRequest] = []
    for fs in friendships:
        user_result = await db.execute(select(User).where(User.id == fs.requester_id))
        requester = user_result.scalar_one_or_none()
        if requester is None:
            continue
        requests.append(
            FriendRequest(
                id=str(fs.id),
                requester=_user_to_public(requester),
                created_at=fs.created_at,
            )
        )
    return requests


# ---- Routes with static prefixes (must come before /{param} routes) ----

@router.post("/request/{user_id}", status_code=status.HTTP_201_CREATED)
async def send_friend_request(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a friend request to another user."""
    me_id = uuid.UUID(principal.id)

    addressee = await _get_user_by_id(db, user_id)

    if str(addressee.id) == principal.id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    # Check for any existing relationship in either direction
    existing = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == me_id, Friendship.addressee_id == addressee.id),
                and_(Friendship.requester_id == addressee.id, Friendship.addressee_id == me_id),
            )
        )
    )
    existing_fs = existing.scalar_one_or_none()
    if existing_fs is not None:
        if existing_fs.status == "blocked":
            raise HTTPException(status_code=403, detail="Cannot send friend request")
        raise HTTPException(status_code=409, detail="Friend request already exists or already friends")

    friendship = Friendship(
        requester_id=me_id,
        addressee_id=addressee.id,
        status="pending",
    )
    db.add(friendship)
    await db.flush()

    await _push_notification(
        db,
        addressee.id,
        "friend_request",
        {
            "from": principal.id,
            "from_name": principal.display_name,
            "request_id": str(friendship.id),
        },
    )

    await db.commit()
    return {"ok": True}


@router.post("/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a pending friend request."""
    me_id = uuid.UUID(principal.id)

    try:
        fs_id = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Friend request not found")

    result = await db.execute(
        select(Friendship).where(
            Friendship.id == fs_id,
            Friendship.addressee_id == me_id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=404, detail="Friend request not found")

    friendship.status = "accepted"
    await db.flush()

    await _push_notification(
        db,
        friendship.requester_id,
        "friend_accepted",
        {
            "from": principal.id,
            "from_name": principal.display_name,
            "friendship_id": str(friendship.id),
        },
    )

    await db.commit()
    return {"ok": True}


@router.delete("/decline/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def decline_friend_request(
    request_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline (delete) a pending friend request addressed to the current user."""
    me_id = uuid.UUID(principal.id)

    try:
        fs_id = uuid.UUID(request_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Friend request not found")

    result = await db.execute(
        select(Friendship).where(
            Friendship.id == fs_id,
            Friendship.addressee_id == me_id,
            Friendship.status == "pending",
        )
    )
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=404, detail="Friend request not found")

    await db.delete(friendship)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/block/{user_id}")
async def block_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block a user (creates or updates a friendship row to 'blocked')."""
    me_id = uuid.UUID(principal.id)

    other = await _get_user_by_id(db, user_id)

    if str(other.id) == principal.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Find any existing relationship
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == me_id, Friendship.addressee_id == other.id),
                and_(Friendship.requester_id == other.id, Friendship.addressee_id == me_id),
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.status = "blocked"
        existing.requester_id = me_id
        existing.addressee_id = other.id
    else:
        friendship = Friendship(
            requester_id=me_id,
            addressee_id=other.id,
            status="blocked",
        )
        db.add(friendship)

    await db.commit()
    return {"ok": True}


@router.delete("/block/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a block — deletes the friendship row."""
    me_id = uuid.UUID(principal.id)

    try:
        other_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Friendship).where(
            Friendship.requester_id == me_id,
            Friendship.addressee_id == other_id,
            Friendship.status == "blocked",
        )
    )
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=404, detail="Block not found")

    await db.delete(friendship)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Generic /{user_id} routes (must come last) ----

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfriend(
    user_id: str,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an accepted friendship."""
    me_id = uuid.UUID(principal.id)

    try:
        other_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.requester_id == me_id, Friendship.addressee_id == other_id),
                and_(Friendship.requester_id == other_id, Friendship.addressee_id == me_id),
            ),
        )
    )
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=404, detail="Friendship not found")

    await db.delete(friendship)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
