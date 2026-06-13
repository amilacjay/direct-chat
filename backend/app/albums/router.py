"""Albums router: private photo albums + chat backgrounds.

Visibility is friends-only: album/background bytes are streamed through the
auth-gated serve endpoints here (never via the public avatars bucket), and every
fetch re-checks an accepted friendship. Guests (no DB row) get an ephemeral
Redis-backed album — that branch lands in a later phase; for now guest writes
are rejected and guest reads return empty.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.deps import Principal, get_current_principal
from app.db.database import get_db
from app.db.models import Album, AlbumImage, User
from app.friends.router import are_friends
from app.redis_client import (
    check_rate,
    delete_guest_album,
    delete_guest_image,
    get_guest_album,
    get_guest_image,
    save_guest_album,
    store_guest_image,
)
from app.schemas import (
    AlbumCreate,
    AlbumImageOut,
    AlbumOut,
    AlbumsUsage,
    AlbumUpdate,
    MyAlbumsResponse,
    PublicAlbumsResponse,
)
from app.storage import delete_media, load_media, save_media

router = APIRouter()

_CONTENT_TYPE_BY_EXT = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
}


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


def _content_type_for_key(key: str) -> str:
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return _CONTENT_TYPE_BY_EXT.get(ext, "application/octet-stream")


def _album_to_out(album: Album) -> AlbumOut:
    return AlbumOut(
        id=str(album.id),
        title=album.title,
        cover_image_id=str(album.cover_image_id) if album.cover_image_id else None,
        position=album.position,
        images=[
            AlbumImageOut(id=str(im.id), content_type=im.content_type, position=im.position)
            for im in album.images
        ],
    )


# --- Guest album helpers (Redis-backed, ephemeral) ------------------------- #
def _guest_album_to_out(album: dict) -> AlbumOut:
    return AlbumOut(
        id=album["id"],
        title=album.get("title", "Album"),
        cover_image_id=album.get("cover_image_id"),
        position=0,
        images=[
            AlbumImageOut(id=im["id"], content_type=im["content_type"], position=im["position"])
            for im in album.get("images", [])
        ],
    )


def _guest_used_bytes(album: Optional[dict]) -> int:
    return sum(im.get("size", 0) for im in album.get("images", [])) if album else 0


def _guest_my_response(album: Optional[dict]) -> MyAlbumsResponse:
    bg = album.get("background_image_id") if album else None
    return MyAlbumsResponse(
        albums=[_guest_album_to_out(album)] if album else [],
        has_background=bool(bg),
        background_image_id=bg,
        usage=AlbumsUsage(
            used_bytes=_guest_used_bytes(album),
            limit_bytes=settings.max_album_bytes_total,
            album_count=1 if album else 0,
            max_albums=settings.max_albums_guest,
            max_images_per_album=settings.max_images_guest_album,
            max_image_bytes=settings.max_album_image_bytes,
        ),
        is_guest=True,
    )


async def _require_guest_album(gid: str, album_id: str) -> dict:
    album = await get_guest_album(gid)
    if not album or album["id"] != album_id:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


async def _guest_upload_image(gid: str, album_id: str, file: UploadFile) -> AlbumImageOut:
    album = await _require_guest_album(gid, album_id)
    if len(album["images"]) >= settings.max_images_guest_album:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Album is full ({settings.max_images_guest_album} images)",
        )

    data = await file.read()
    if len(data) > settings.max_album_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum size of {settings.max_album_image_bytes} bytes",
        )
    image_type = _detect_image_type(data)
    if image_type is None:
        raise HTTPException(status_code=400, detail="Unsupported image format. Allowed: jpeg, png, gif, webp")
    if _guest_used_bytes(album) + len(data) > settings.max_album_bytes_total:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Storage quota exceeded (50 MB total)",
        )

    ext = "jpg" if image_type == "jpeg" else image_type
    content_type = _CONTENT_TYPE_BY_EXT.get(ext, "application/octet-stream")
    img_id = uuid.uuid4().hex
    await store_guest_image(img_id, gid, content_type, data)

    img = {"id": img_id, "content_type": content_type, "size": len(data), "position": len(album["images"])}
    album["images"].append(img)
    if album.get("cover_image_id") is None:
        album["cover_image_id"] = img_id
    await save_guest_album(gid, album)
    return AlbumImageOut(id=img_id, content_type=content_type, position=img["position"])


async def _owner(db: AsyncSession, principal: Principal) -> User:
    """Load the live ORM User for a registered caller (for committable writes)."""
    result = await db.execute(select(User).where(User.id == uuid.UUID(principal.id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _load_album(db: AsyncSession, album_id: str, owner_id: str) -> Album:
    try:
        aid = uuid.UUID(album_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Album not found")
    result = await db.execute(
        select(Album)
        .where(Album.id == aid, Album.user_id == uuid.UUID(owner_id))
        .options(selectinload(Album.images))
    )
    album = result.scalar_one_or_none()
    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


async def _images_bytes(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(AlbumImage.size_bytes), 0))
        .select_from(AlbumImage)
        .join(Album, AlbumImage.album_id == Album.id)
        .where(Album.user_id == user_id)
    )
    return int(result.scalar() or 0)


async def _albums_for(db: AsyncSession, user_id: uuid.UUID) -> list[Album]:
    result = await db.execute(
        select(Album)
        .where(Album.user_id == user_id)
        .order_by(Album.position, Album.created_at)
        .options(selectinload(Album.images))
    )
    return list(result.scalars().all())


def _usage(images_bytes: int, bg_size: int, album_count: int) -> AlbumsUsage:
    return AlbumsUsage(
        used_bytes=images_bytes + bg_size,
        limit_bytes=settings.max_album_bytes_total,
        album_count=album_count,
        max_albums=settings.max_albums_registered,
        max_images_per_album=settings.max_images_per_album,
        max_image_bytes=settings.max_album_image_bytes,
    )


# --------------------------------------------------------------------------- #
# My albums
# --------------------------------------------------------------------------- #
@router.get("/me", response_model=MyAlbumsResponse)
async def my_albums(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        return _guest_my_response(await get_guest_album(principal.id))

    user = await _owner(db, principal)
    uid = user.id
    albums = await _albums_for(db, uid)
    images_bytes = await _images_bytes(db, uid)

    # If the background key matches one of the user's album images, surface that
    # image id so the UI can show which image is in use.
    bg_image_id: Optional[str] = None
    if user.chat_background_key:
        for album in albums:
            for im in album.images:
                if im.object_key == user.chat_background_key:
                    bg_image_id = str(im.id)
                    break
            if bg_image_id:
                break

    return MyAlbumsResponse(
        albums=[_album_to_out(a) for a in albums],
        has_background=bool(user.chat_background_key),
        background_image_id=bg_image_id,
        usage=_usage(images_bytes, user.chat_background_size, len(albums)),
        is_guest=False,
    )


@router.post("", response_model=AlbumOut, status_code=status.HTTP_201_CREATED)
async def create_album(
    body: AlbumCreate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        if await get_guest_album(principal.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Album limit reached ({settings.max_albums_guest})",
            )
        album = {
            "id": uuid.uuid4().hex,
            "title": (body.title or "Album").strip() or "Album",
            "cover_image_id": None,
            "images": [],
            "background_image_id": None,
        }
        await save_guest_album(principal.id, album)
        return _guest_album_to_out(album)

    user = await _owner(db, principal)

    count = await db.scalar(
        select(func.count(Album.id)).where(Album.user_id == user.id)
    )
    if (count or 0) >= settings.max_albums_registered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Album limit reached ({settings.max_albums_registered})",
        )

    album = Album(user_id=user.id, title=(body.title or "Album").strip() or "Album", position=count or 0)
    db.add(album)
    await db.flush()
    await db.refresh(album, attribute_names=["images"])
    await db.commit()
    return _album_to_out(album)


@router.patch("/{album_id}", response_model=AlbumOut)
async def update_album(
    album_id: str,
    body: AlbumUpdate,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        g = await _require_guest_album(principal.id, album_id)
        if body.title is not None:
            g["title"] = body.title.strip() or g["title"]
        if "cover_image_id" in body.model_fields_set:
            if body.cover_image_id is None:
                g["cover_image_id"] = None
            elif any(im["id"] == body.cover_image_id for im in g["images"]):
                g["cover_image_id"] = body.cover_image_id
            else:
                raise HTTPException(status_code=400, detail="Cover must be an image in this album")
        await save_guest_album(principal.id, g)
        return _guest_album_to_out(g)

    album = await _load_album(db, album_id, principal.id)

    if body.title is not None:
        album.title = body.title.strip() or album.title

    if "cover_image_id" in body.model_fields_set:
        if body.cover_image_id is None:
            album.cover_image_id = None
        else:
            try:
                cover = uuid.UUID(body.cover_image_id)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid cover_image_id")
            if not any(im.id == cover for im in album.images):
                raise HTTPException(status_code=400, detail="Cover must be an image in this album")
            album.cover_image_id = cover

    await db.commit()
    await db.refresh(album, attribute_names=["images"])
    return _album_to_out(album)


@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album(
    album_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        await _require_guest_album(principal.id, album_id)
        await delete_guest_album(principal.id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    album = await _load_album(db, album_id, principal.id)

    keys = [im.object_key for im in album.images]
    # If the chat background reused one of these images, clear it first.
    user = await _owner(db, principal)
    if user.chat_background_key in keys:
        user.chat_background_key = None
        user.chat_background_size = 0

    await db.delete(album)
    await db.commit()

    for key in keys:
        await delete_media(key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Images
# --------------------------------------------------------------------------- #
@router.post("/{album_id}/images", response_model=AlbumImageOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    album_id: str,
    file: UploadFile,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if not await check_rate(f"rate_album:{principal.id}", settings.rate_album_upload_per_min):
        raise HTTPException(status_code=429, detail="Upload rate limit exceeded")

    if principal.is_guest:
        return await _guest_upload_image(principal.id, album_id, file)

    album = await _load_album(db, album_id, principal.id)
    if len(album.images) >= settings.max_images_per_album:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Album is full ({settings.max_images_per_album} images)",
        )

    data = await file.read()
    if len(data) > settings.max_album_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum size of {settings.max_album_image_bytes} bytes",
        )

    image_type = _detect_image_type(data)
    if image_type is None:
        raise HTTPException(status_code=400, detail="Unsupported image format. Allowed: jpeg, png, gif, webp")

    user = await _owner(db, principal)
    used = await _images_bytes(db, user.id) + user.chat_background_size
    if used + len(data) > settings.max_album_bytes_total:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Storage quota exceeded (50 MB total)",
        )

    ext = "jpg" if image_type == "jpeg" else image_type
    key = await save_media(principal.id, ext, data)

    image = AlbumImage(
        album_id=album.id,
        object_key=key,
        content_type=_CONTENT_TYPE_BY_EXT.get(ext, "application/octet-stream"),
        size_bytes=len(data),
        position=len(album.images),
    )
    db.add(image)
    await db.flush()

    # First image becomes the album cover by default.
    if album.cover_image_id is None:
        album.cover_image_id = image.id

    await db.commit()
    await db.refresh(image)
    return AlbumImageOut(id=str(image.id), content_type=image.content_type, position=image.position)


@router.delete("/{album_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    album_id: str,
    image_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        g = await _require_guest_album(principal.id, album_id)
        if not any(im["id"] == image_id for im in g["images"]):
            raise HTTPException(status_code=404, detail="Image not found")
        g["images"] = [im for im in g["images"] if im["id"] != image_id]
        if g.get("cover_image_id") == image_id:
            g["cover_image_id"] = g["images"][0]["id"] if g["images"] else None
        if g.get("background_image_id") == image_id:
            g["background_image_id"] = None
        await delete_guest_image(image_id)
        await save_guest_album(principal.id, g)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    album = await _load_album(db, album_id, principal.id)

    try:
        iid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Image not found")
    image = next((im for im in album.images if im.id == iid), None)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    key = image.object_key

    # Reassign cover and clear a background that pointed at this image.
    if album.cover_image_id == iid:
        remaining = [im for im in album.images if im.id != iid]
        album.cover_image_id = remaining[0].id if remaining else None

    user = await _owner(db, principal)
    if user.chat_background_key == key:
        user.chat_background_key = None
        user.chat_background_size = 0

    await db.delete(image)
    await db.commit()

    await delete_media(key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Chat background
# --------------------------------------------------------------------------- #
@router.put("/background", response_model=MyAlbumsResponse)
async def set_background_upload(
    file: UploadFile,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guests can set a background from an album image",
        )
    user = await _owner(db, principal)

    data = await file.read()
    if len(data) > settings.max_album_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum size of {settings.max_album_image_bytes} bytes",
        )
    image_type = _detect_image_type(data)
    if image_type is None:
        raise HTTPException(status_code=400, detail="Unsupported image format. Allowed: jpeg, png, gif, webp")

    # Free the previous dedicated background (size 0 == a borrowed album image).
    old_key, old_dedicated = user.chat_background_key, user.chat_background_size > 0

    images_bytes = await _images_bytes(db, user.id)
    if images_bytes + len(data) > settings.max_album_bytes_total:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Storage quota exceeded (50 MB total)",
        )

    ext = "jpg" if image_type == "jpeg" else image_type
    key = await save_media(principal.id, ext, data)
    user.chat_background_key = key
    user.chat_background_size = len(data)
    await db.commit()

    if old_dedicated and old_key and old_key != key:
        await delete_media(old_key)
    return await my_albums(principal, db)


@router.put("/background/from-image/{image_id}", response_model=MyAlbumsResponse)
async def set_background_from_image(
    image_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        g = await get_guest_album(principal.id)
        if not g or not any(im["id"] == image_id for im in g["images"]):
            raise HTTPException(status_code=404, detail="Image not found")
        g["background_image_id"] = image_id
        await save_guest_album(principal.id, g)
        return _guest_my_response(g)

    user = await _owner(db, principal)

    try:
        iid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Image not found")

    # The image must belong to one of the caller's own albums.
    result = await db.execute(
        select(AlbumImage)
        .join(Album, AlbumImage.album_id == Album.id)
        .where(AlbumImage.id == iid, Album.user_id == user.id)
    )
    image = result.scalar_one_or_none()
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")

    old_key, old_dedicated = user.chat_background_key, user.chat_background_size > 0
    user.chat_background_key = image.object_key
    user.chat_background_size = 0  # shared object — not double-counted
    await db.commit()

    if old_dedicated and old_key and old_key != image.object_key:
        await delete_media(old_key)
    return await my_albums(principal, db)


@router.delete("/background", response_model=MyAlbumsResponse)
async def clear_background(
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    if principal.is_guest:
        g = await get_guest_album(principal.id)
        if g:
            g["background_image_id"] = None
            await save_guest_album(principal.id, g)
        return _guest_my_response(g)

    user = await _owner(db, principal)
    old_key, old_dedicated = user.chat_background_key, user.chat_background_size > 0
    user.chat_background_key = None
    user.chat_background_size = 0
    await db.commit()
    if old_dedicated and old_key:
        await delete_media(old_key)
    return await my_albums(principal, db)


# --------------------------------------------------------------------------- #
# Viewing another user (friends-only)
# --------------------------------------------------------------------------- #
@router.get("/user/{user_id}", response_model=PublicAlbumsResponse)
async def user_albums(
    user_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    # Guest-owned albums have no friend graph: any authenticated viewer (i.e. the
    # chat peer) may see them while the guest is online.
    if user_id.startswith("guest:"):
        g = await get_guest_album(user_id)
        return PublicAlbumsResponse(
            user_id=user_id,
            can_view=True,
            has_background=bool(g and g.get("background_image_id")),
            albums=[_guest_album_to_out(g)] if g else [],
        )

    can_view = await _can_view(db, principal, user_id)
    if not can_view:
        return PublicAlbumsResponse(user_id=user_id, can_view=False, has_background=False, albums=[])

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        return PublicAlbumsResponse(user_id=user_id, can_view=False, has_background=False, albums=[])

    owner = await db.scalar(select(User).where(User.id == uid))
    albums = await _albums_for(db, uid)
    return PublicAlbumsResponse(
        user_id=user_id,
        can_view=True,
        has_background=bool(owner and owner.chat_background_key),
        albums=[_album_to_out(a) for a in albums],
    )


async def _can_view(db: AsyncSession, principal: Principal, owner_id: str) -> bool:
    """Whether `principal` may see registered user `owner_id`'s albums/background.

    Albums are friends-only *between registered users*. Guests have no friend
    graph, so a guest viewer is always allowed — otherwise the album/background
    decorations would never appear in any chat involving a guest.
    """
    if principal.is_guest:
        return True
    return await are_friends(db, principal.id, owner_id)


def _no_store_image(data: bytes, content_type: str) -> Response:
    # Private: friend-gated, so allow the browser to cache it but never shared
    # caches/CDNs.
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "private, max-age=300"})


@router.get("/image/{image_id}")
async def serve_image(
    image_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    # An image_id may be a registered DB image (UUID) or an ephemeral guest image
    # (Redis hex). Try the DB first; fall back to the guest store.
    row = None
    try:
        iid = uuid.UUID(image_id)
        result = await db.execute(
            select(AlbumImage, Album.user_id)
            .join(Album, AlbumImage.album_id == Album.id)
            .where(AlbumImage.id == iid)
        )
        row = result.first()
    except ValueError:
        row = None

    if row is None:
        guest_img = await get_guest_image(image_id)
        if guest_img is None:
            raise HTTPException(status_code=404, detail="Image not found")
        # Guest images are viewable by any authenticated user (no friend graph).
        return _no_store_image(guest_img["blob"], guest_img["content_type"])

    image, owner_id = row
    if not await _can_view(db, principal, str(owner_id)):
        raise HTTPException(status_code=403, detail="Not permitted")

    try:
        data = await load_media(image.object_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image not found")
    return _no_store_image(data, image.content_type)


@router.get("/background/{user_id}")
async def serve_background(
    user_id: str,
    principal: Principal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
):
    # Guest background: stored as one of the guest's album images.
    if user_id.startswith("guest:"):
        g = await get_guest_album(user_id)
        bg_id = g.get("background_image_id") if g else None
        guest_img = await get_guest_image(bg_id) if bg_id else None
        if guest_img is None:
            raise HTTPException(status_code=404, detail="No background")
        return _no_store_image(guest_img["blob"], guest_img["content_type"])

    if not await _can_view(db, principal, user_id):
        raise HTTPException(status_code=403, detail="Not permitted")
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")

    owner = await db.scalar(select(User).where(User.id == uid))
    if owner is None or not owner.chat_background_key:
        raise HTTPException(status_code=404, detail="No background")

    try:
        data = await load_media(owner.chat_background_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="No background")
    return _no_store_image(data, _content_type_for_key(owner.chat_background_key))
