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


class GuestProfileUpdate(BaseModel):
    """Guest-editable profile fields. Re-issues the guest token with new claims."""
    display_name: Optional[str] = Field(default=None, min_length=3, max_length=30)
    gender: Optional[str] = Field(default=None, max_length=20)
    age: Optional[int] = Field(default=None, ge=1, le=120)


# ---- Users ----
class PublicUser(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    show_gender: bool = True
    show_age: bool = True
    is_guest: bool = False
    created_at: Optional[datetime] = None
    accent_hue: Optional[int] = None
    share_location: bool = False


VALID_GENDERS = {"male", "female", "nonbinary", "other"}


class UpdateProfile(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=3, max_length=30)
    bio: Optional[str] = Field(default=None, max_length=300)
    location: Optional[str] = Field(default=None, max_length=100)
    gender: Optional[str] = Field(default=None, max_length=20)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    show_gender: Optional[bool] = None
    show_age: Optional[bool] = None
    appear_online: Optional[bool] = None
    accent_hue: Optional[int] = Field(default=None, ge=0, le=360)
    share_location: Optional[bool] = None


class OnlineUser(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    is_guest: bool = False


class NearbyUser(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    is_guest: bool = False
    accent_hue: Optional[int] = None
    lat: float
    lng: float
    distance_km: float


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


# ---- Albums ----
class AlbumImageOut(BaseModel):
    id: str
    content_type: str
    position: int


class AlbumOut(BaseModel):
    id: str
    title: str
    cover_image_id: Optional[str] = None
    position: int
    images: list[AlbumImageOut] = Field(default_factory=list)


class AlbumsUsage(BaseModel):
    used_bytes: int
    limit_bytes: int
    album_count: int
    max_albums: int
    max_images_per_album: int
    max_image_bytes: int


class MyAlbumsResponse(BaseModel):
    """The caller's own albums, plus quota + background state."""
    albums: list[AlbumOut] = Field(default_factory=list)
    has_background: bool = False
    # Set when the background reuses an album image (so the UI can highlight it).
    background_image_id: Optional[str] = None
    usage: AlbumsUsage
    is_guest: bool = False


class PublicAlbumsResponse(BaseModel):
    """Another user's albums as seen by the caller (empty if not permitted)."""
    user_id: str
    can_view: bool = False
    has_background: bool = False
    albums: list[AlbumOut] = Field(default_factory=list)


class AlbumCreate(BaseModel):
    title: Optional[str] = Field(default="Album", min_length=1, max_length=60)


class AlbumUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=60)
    cover_image_id: Optional[str] = None


# ---- WebRTC / WS config ----
class IceServer(BaseModel):
    urls: str
    username: Optional[str] = None
    credential: Optional[str] = None


class RtcConfig(BaseModel):
    ice_servers: list[IceServer]


# ---- WebSocket message envelope ----
WsType = Literal[
    "presence",         # server -> client: online list / changes
    "signal",           # client <-> client via server: webrtc sdp/ice
    "relay",            # client <-> client via server: fallback text message
    "notification",     # server -> client: friend events
    "presence_set",     # client -> server: set appear_online
    "location_update",  # client -> server: share current coordinates
    "location_off",     # client -> server: stop sharing location
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
