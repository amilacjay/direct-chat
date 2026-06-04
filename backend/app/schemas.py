"""Shared Pydantic schemas — the API contract between backend and frontend."""
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---- Auth ----
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_guest: bool
    user: "PublicUser"


class GuestCreate(BaseModel):
    pass


class DevLoginRequest(BaseModel):
    """Dev-only login used by automated tests (guarded by DEV_AUTH_ENABLED)."""
    email: str
    display_name: str
    dob: str  # ISO date YYYY-MM-DD


class CompleteRegistrationRequest(BaseModel):
    dob: str  # ISO date YYYY-MM-DD


# ---- Users ----
class PublicUser(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    is_guest: bool = False
    created_at: Optional[datetime] = None


class UpdateProfile(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=3, max_length=30)
    bio: Optional[str] = Field(default=None, max_length=300)
    location: Optional[str] = Field(default=None, max_length=100)
    appear_online: Optional[bool] = None


class OnlineUser(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    is_guest: bool = False


# ---- Friends ----
class FriendRequest(BaseModel):
    id: str
    requester: PublicUser
    created_at: datetime


class Friend(BaseModel):
    user: PublicUser
    friendship_id: str


# ---- Notifications ----
class NotificationOut(BaseModel):
    id: str
    type: str
    payload: dict
    read: bool
    created_at: datetime


# ---- Photos ----
class PhotoUploadResponse(BaseModel):
    token: str
    expires_at: datetime


# ---- WebRTC / WS config ----
class IceServer(BaseModel):
    urls: str
    username: Optional[str] = None
    credential: Optional[str] = None


class RtcConfig(BaseModel):
    ice_servers: list[IceServer]


# ---- WebSocket message envelope ----
WsType = Literal[
    "presence",        # server -> client: online list / changes
    "signal",          # client <-> client via server: webrtc sdp/ice
    "relay",           # client <-> client via server: fallback text message
    "notification",    # server -> client: friend events
    "presence_set",    # client -> server: set appear_online
    "ping",
    "pong",
    "error",
]


class WsMessage(BaseModel):
    type: str
    # routing
    to: Optional[str] = None      # target user id
    from_: Optional[str] = Field(default=None, alias="from")
    # payload (signal/relay/etc)
    data: Optional[dict] = None

    model_config = {"populate_by_name": True}


TokenResponse.model_rebuild()
