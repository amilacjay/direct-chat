"""Photos router: ephemeral photo upload and single-delivery fetch."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile, status

from app.config import settings
from app.core.deps import Principal, get_current_user, get_current_principal
from app.redis_client import check_rate, delete_photo, fetch_photo, store_photo
from app.schemas import PhotoUploadResponse

router = APIRouter()


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


def _ext_to_content_type(image_type: str) -> str:
    return {
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }.get(image_type, "application/octet-stream")


@router.post("/upload", response_model=PhotoUploadResponse, status_code=status.HTTP_200_OK)
async def upload_photo(
    file: UploadFile,
    to: str = Form(...),
    principal: Principal = Depends(get_current_user),
):
    """Upload an ephemeral photo to be fetched once by the recipient."""
    me = principal

    # Rate limit
    if not await check_rate(f"rate_photo:{me.id}", settings.rate_photo_per_min):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Photo upload rate limit exceeded",
        )

    data = await file.read()

    if len(data) > settings.max_photo_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Photo exceeds maximum size of {settings.max_photo_bytes} bytes",
        )

    image_type = _detect_image_type(data)
    if image_type is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Allowed: jpeg, png, gif, webp",
        )

    content_type = _ext_to_content_type(image_type)
    token = uuid.uuid4().hex

    await store_photo(token, me.id, to, data, content_type)

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.photo_buffer_ttl_seconds)
    return PhotoUploadResponse(token=token, expires_at=expires_at)


@router.get("/{token}")
async def fetch_photo_endpoint(
    token: str,
    principal: Principal = Depends(get_current_principal),
):
    """Fetch a photo by token (single delivery — deleted after retrieval)."""
    photo = await fetch_photo(token)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found or expired")

    owner_id: str = photo["owner"]
    recipient_id: str = photo["recipient"]
    requester_id: str = principal.id

    if requester_id not in (owner_id, recipient_id):
        raise HTTPException(status_code=403, detail="Access denied")

    blob: bytes = photo["blob"]
    content_type: str = photo["content_type"]

    # Single delivery — delete after fetch
    await delete_photo(token)

    return Response(content=blob, media_type=content_type)
