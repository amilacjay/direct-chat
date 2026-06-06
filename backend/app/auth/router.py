"""Auth router: Google OAuth2, guest login, dev login, registration completion."""
import uuid
from datetime import date
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import (
    create_access_token,
    decrypt_field,
    encrypt_field,
    is_adult,
)
from app.db.database import get_db
from app.db.models import User
from app.schemas import CompleteRegistrationRequest, DevLoginRequest, PublicUser, TokenResponse

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


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


@router.get("/google")
async def google_login():
    """Redirect to Google OAuth2 consent page."""
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")

    params = (
        f"client_id={settings.google_client_id}"
        f"&redirect_uri={settings.google_redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
        f"&prompt=select_account"
    )
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/google/callback")
async def google_callback(code: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Exchange OAuth code for tokens, redirect to frontend with JWT."""
    frontend_cb = f"{settings.frontend_origin}/login/callback"
    if not code:
        return RedirectResponse(url=f"{frontend_cb}?error=oauth")

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()

            # Fetch userinfo
            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

    except Exception:
        return RedirectResponse(url=f"{frontend_cb}?error=oauth")

    sub: str = userinfo.get("sub", "")
    name: str = userinfo.get("name", "User")
    picture: Optional[str] = userinfo.get("picture")
    email: Optional[str] = userinfo.get("email")

    # Look up existing user by google_sub
    result = await db.execute(select(User).where(User.google_sub == sub))
    user = result.scalar_one_or_none()

    if user is not None:
        # Existing user — issue real token
        token = create_access_token(subject=str(user.id), is_guest=False, extra={"name": user.display_name})
        return RedirectResponse(url=f"{frontend_cb}?token={token}&new=0")

    # New user — issue pending token for registration
    pending_token = create_access_token(
        subject=sub,
        is_guest=False,
        extra={"pending": True, "name": name, "picture": picture},
    )
    return RedirectResponse(url=f"{frontend_cb}?token={pending_token}&new=1")


@router.post("/complete-registration", response_model=TokenResponse)
async def complete_registration(
    body: CompleteRegistrationRequest,
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Complete registration for a pending Google OAuth user."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    raw_token = authorization.split(" ", 1)[1].strip()

    from app.core.security import decode_token
    try:
        payload = decode_token(raw_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if not payload.get("pending"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a pending token")

    sub: str = payload.get("sub", "")
    name: str = payload.get("name", "User")
    picture: Optional[str] = payload.get("picture")

    try:
        dob = date.fromisoformat(body.dob)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")

    if not is_adult(dob):
        raise HTTPException(status_code=403, detail="You must be 18 or older to register")

    # Check for race condition — user may already exist
    result = await db.execute(select(User).where(User.google_sub == sub))
    existing = result.scalar_one_or_none()
    if existing is not None:
        token = create_access_token(subject=str(existing.id), is_guest=False, extra={"name": existing.display_name})
        return TokenResponse(
            access_token=token,
            is_guest=False,
            user=_user_to_public(existing),
        )

    user = User(
        google_sub=sub,
        display_name=name or "User",
        avatar_url=picture,
        dob_encrypted=encrypt_field(dob.isoformat()),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=str(user.id), is_guest=False, extra={"name": user.display_name})
    return TokenResponse(
        access_token=token,
        is_guest=False,
        user=_user_to_public(user),
    )


@router.post("/guest", response_model=TokenResponse)
async def guest_login():
    """Create a temporary guest session."""
    guest_id = f"guest:{uuid.uuid4().hex}"
    display_name = f"Guest-{uuid.uuid4().hex[:4].upper()}"
    token = create_access_token(
        subject=guest_id,
        is_guest=True,
        extra={"name": display_name},
    )
    return TokenResponse(
        access_token=token,
        is_guest=True,
        user=PublicUser(id=guest_id, display_name=display_name, is_guest=True),
    )


@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(body: DevLoginRequest, db: AsyncSession = Depends(get_db)):
    """Dev-only login — creates or retrieves a user by email (no Google needed)."""
    if not settings.dev_auth_enabled:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        dob = date.fromisoformat(body.dob)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")

    if not is_adult(dob):
        raise HTTPException(status_code=403, detail="You must be 18 or older to register")

    google_sub = f"dev:{body.email}"
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            google_sub=google_sub,
            display_name=body.display_name,
            dob_encrypted=encrypt_field(dob.isoformat()),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = create_access_token(subject=str(user.id), is_guest=False, extra={"name": user.display_name})
    return TokenResponse(
        access_token=token,
        is_guest=False,
        user=_user_to_public(user),
    )


@router.post("/logout")
async def logout():
    """Stateless logout — client should discard the token."""
    return {"ok": True}
