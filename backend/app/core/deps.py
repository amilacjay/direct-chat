"""Authentication dependencies. Resolves the JWT into a Principal.

Registered users exist in the DB; guests live only in the token + Redis presence.

Read endpoints use get_current_principal which checks the Redis user-data cache
before hitting Postgres. Write endpoints use get_fresh_user which always queries
the DB and returns the real SQLAlchemy User ORM object needed for commits.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.database import get_db
from app.db.models import User
from app.redis_client import get_cached_user_data, set_cached_user_data


@dataclass
class CachedUser:
    """Lightweight mirror of User ORM built from Redis cache.
    Has the same attribute interface so _user_to_public works on both."""
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    show_gender: bool = True
    show_age: bool = True
    appear_online: bool = True
    accent_hue: Optional[int] = None
    share_location: bool = False
    created_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, d: dict) -> "CachedUser":
        created_at = None
        if d.get("created_at"):
            try:
                created_at = datetime.fromisoformat(d["created_at"])
            except ValueError:
                pass
        return cls(
            id=d["id"],
            display_name=d["display_name"],
            avatar_url=d.get("avatar_url"),
            bio=d.get("bio"),
            location=d.get("location"),
            gender=d.get("gender"),
            age=d.get("age"),
            show_gender=d.get("show_gender", True),
            show_age=d.get("show_age", True),
            appear_online=d.get("appear_online", True),
            accent_hue=d.get("accent_hue"),
            share_location=d.get("share_location", False),
            created_at=created_at,
        )


@dataclass
class Principal:
    id: str
    is_guest: bool
    display_name: str
    user: Optional[object] = None  # User ORM or CachedUser depending on code path


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return authorization.split(" ", 1)[1].strip()


async def _resolve_registered_principal(uid: uuid.UUID, db: AsyncSession) -> Principal:
    """Check Redis cache; fall back to Postgres on miss."""
    cached = await get_cached_user_data(str(uid))
    if cached:
        cu = CachedUser.from_dict(cached)
        return Principal(id=str(uid), is_guest=False, display_name=cu.display_name, user=cu)

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    await set_cached_user_data(str(uid), user)
    return Principal(id=str(user.id), is_guest=False, display_name=user.display_name, user=user)


async def get_current_principal(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    """For read endpoints. Uses the Redis user-data cache; hits Postgres only on miss."""
    token = _extract_token(authorization)
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload.get("sub")
    is_guest = bool(payload.get("guest", False))
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    if is_guest:
        return Principal(id=sub, is_guest=True, display_name=payload.get("name", "Guest"))

    try:
        uid = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    return await _resolve_registered_principal(uid, db)


async def get_fresh_user(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    """For write endpoints. Always queries Postgres to get the live ORM object."""
    token = _extract_token(authorization)
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload.get("sub")
    is_guest = bool(payload.get("guest", False))
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    if is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a registered account",
        )

    try:
        uid = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return Principal(id=str(user.id), is_guest=False, display_name=user.display_name, user=user)


async def get_current_user(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    """Require a registered (non-guest) user. Uses cache — do not use for writes."""
    if principal.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a registered account",
        )
    return principal
