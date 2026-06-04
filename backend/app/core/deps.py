"""Authentication dependencies. Resolves the JWT into a Principal.

Registered users exist in the DB; guests live only in the token + Redis presence.
"""
import uuid
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.database import get_db
from app.db.models import User


@dataclass
class Principal:
    id: str
    is_guest: bool
    display_name: str
    user: Optional[User] = None  # populated for registered users


async def _principal_from_token(token: str, db: AsyncSession) -> Principal:
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    sub = payload.get("sub")
    is_guest = bool(payload.get("guest", False))
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    if is_guest:
        return Principal(
            id=sub,
            is_guest=True,
            display_name=payload.get("name", "Guest"),
        )

    try:
        uid = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token subject")
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return Principal(
        id=str(user.id),
        is_guest=False,
        display_name=user.display_name,
        user=user,
    )


def _extract_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return authorization.split(" ", 1)[1].strip()


async def get_current_principal(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    token = _extract_token(authorization)
    return await _principal_from_token(token, db)


async def get_current_user(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    """Require a registered (non-guest) user."""
    if principal.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a registered account",
        )
    return principal
