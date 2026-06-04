"""Avatar storage: MinIO with local-directory fallback.

save_avatar(user_id, ext, data) -> url string
AVATAR_DIR exposes the local fallback path so main.py can mount it as a static dir.
"""
import asyncio
import io
import json
import logging
import uuid
from functools import partial
from pathlib import Path

from app.config import settings

logger = logging.getLogger("storage")

AVATAR_DIR: str = settings.local_avatar_dir


def _public_read_policy(bucket: str) -> str:
    """Anonymous read-only policy so avatars are fetchable without credentials
    (they are served through nginx at /<bucket>/<object>)."""
    return json.dumps(
        {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
    )


async def save_avatar(user_id: str, ext: str, data: bytes) -> str:
    """Save avatar bytes, returning a publicly-accessible URL.

    Tries MinIO first (run in threadpool, as the SDK is synchronous);
    falls back to writing to AVATAR_DIR on any failure.
    """
    if not settings.minio_enabled:
        return _save_local(user_id, ext, data)
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, partial(_save_minio, user_id, ext, data))
    except Exception as exc:
        logger.warning("MinIO upload failed (%s), using local fallback", exc)
        return _save_local(user_id, ext, data)


def _save_minio(user_id: str, ext: str, data: bytes) -> str:
    """Synchronous MinIO upload (minio SDK is synchronous)."""
    import minio  # deferred import so missing package only fails at runtime

    client = minio.Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )
    bucket = settings.minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    # Ensure objects are anonymously readable (idempotent; also fixes a bucket
    # created before this policy existed).
    try:
        client.set_bucket_policy(bucket, _public_read_policy(bucket))
    except Exception as exc:  # noqa: BLE001 - non-fatal, log and continue
        logger.warning("Failed to set public bucket policy: %s", exc)

    object_name = f"avatar_{user_id}_{uuid.uuid4().hex}.{ext}"
    client.put_object(
        bucket,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type=_content_type(ext),
    )
    return f"{settings.minio_public_url}/{bucket}/{object_name}"


def _save_local(user_id: str, ext: str, data: bytes) -> str:
    """Write avatar to the local fallback directory."""
    dir_path = Path(settings.local_avatar_dir)
    dir_path.mkdir(parents=True, exist_ok=True)

    filename = f"avatar_{user_id}_{uuid.uuid4().hex}.{ext}"
    dest = dir_path / filename
    dest.write_bytes(data)
    return f"/avatars/{filename}"


def _content_type(ext: str) -> str:
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
    }.get(ext.lower(), "application/octet-stream")
