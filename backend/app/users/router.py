"""Users router: profile retrieval, update, avatar upload, online list."""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.deps import Principal, get_current_principal, get_current_user
from app.db.database import get_db
from app.db.models import User
from app.redis_client import list_online
from app.schemas import VALID_GENDERS, OnlineUser, PublicUser, UpdateProfile
from app.storage import save_avatar

router = APIRouter()

_DISPLAY_NAME_RE = re.compile(r"^[A-Za-z0-9 _-]{3,30}$")

# Magic bytes for image type detection
_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "jpeg"),
    (b"\x89PNG", "png"),
    (b"GIF8", "gif"),
    (b"RIFF", "webp"),  # further check below
]


def _detect_image_type(data: bytes) -> Optional[str]:
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:4] == b"\x89PNG":
        return "png"
    if data[:4] in (b"GIF8", b"GIF9"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _user_to_public(user: User, for_self: bool = False) -> PublicUser:
    return PublicUser(
        id=str(user.id),
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        location=user.location,
        gender=user.gender if (for_self or user.show_gender) else None,
        age=user.age if (for_self or user.show_age) else None,
        show_gender=user.show_gender,
        show_age=user.show_age,
        is_guest=False,
        created_at=user.created_at,
    )


@router.get("/online", response_model=list[OnlineUser])
async def get_online_users(principal: Principal = Depends(get_current_principal)):
    """Return the list of online users, excluding the caller."""
    raw = await list_online()
    result: list[OnlineUser] = []
    for item in raw:
        if item["id"] == principal.id:
            continue
        result.append(
            OnlineUser(
                id=item["id"],
                display_name=item["display_name"],
                avatar_url=item.get("avatar_url"),
                is_guest=item.get("is_guest", False),
            )
        )
    return result


@router.get("/me", response_model=PublicUser)
async def get_me(principal: Principal = Depends(get_current_principal)):
    """Return the current user's public profile."""
    if principal.is_guest:
        return PublicUser(
            id=principal.id,
            display_name=principal.display_name,
            is_guest=True,
        )
    return _user_to_public(principal.user, for_self=True)


@router.patch("/me", response_model=PublicUser)
async def update_me(
    body: UpdateProfile,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current registered user's profile."""
    user = principal.user

    if body.display_name is not None:
        if not _DISPLAY_NAME_RE.match(body.display_name):
            raise HTTPException(
                status_code=400,
                detail="display_name must be 3-30 chars, only letters, numbers, spaces, _ and -",
            )
        user.display_name = body.display_name

    if body.bio is not None:
        user.bio = body.bio

    if body.location is not None:
        user.location = body.location

    if 'gender' in body.model_fields_set:
        if body.gender and body.gender not in VALID_GENDERS:
            raise HTTPException(
                status_code=400,
                detail=f"gender must be one of: {', '.join(sorted(VALID_GENDERS))}",
            )
        user.gender = body.gender or None

    if 'age' in body.model_fields_set:
        user.age = body.age

    if body.show_gender is not None:
        user.show_gender = body.show_gender

    if body.show_age is not None:
        user.show_age = body.show_age

    if body.appear_online is not None:
        user.appear_online = body.appear_online

    await db.commit()
    await db.refresh(user)
    return _user_to_public(user, for_self=True)


@router.post("/me/avatar", response_model=PublicUser)
async def upload_avatar(
    file: UploadFile,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new avatar image for the current user."""
    data = await file.read()

    if len(data) > settings.max_avatar_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Avatar exceeds maximum size of {settings.max_avatar_bytes} bytes",
        )

    image_type = _detect_image_type(data)
    if image_type is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Allowed: jpeg, png, gif, webp",
        )

    ext = "jpg" if image_type == "jpeg" else image_type
    url = await save_avatar(str(principal.user.id), ext, data)

    user = principal.user
    user.avatar_url = url
    await db.commit()
    await db.refresh(user)
    return _user_to_public(user, for_self=True)


@router.get("/{user_id}", response_model=PublicUser)
async def get_user(
    user_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a user's public profile by ID."""
    import uuid as _uuid

    # Guest IDs are not stored in DB
    if user_id.startswith("guest:"):
        raise HTTPException(status_code=404, detail="User not found")

    try:
        uid = _uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_to_public(user)
