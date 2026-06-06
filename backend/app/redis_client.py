"""Shared async Redis client and presence/rate-limit/photo-buffer helpers."""
import json
import time
from typing import Optional

import redis.asyncio as redis

from app.config import settings

_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        if settings.use_fake_redis:
            import fakeredis.aioredis as fakeredis

            _client = fakeredis.FakeRedis(decode_responses=False)
        else:
            _client = redis.from_url(settings.redis_url, decode_responses=False)
    return _client


# ---- Presence ----
PRESENCE_KEY = "presence:{uid}"
PRESENCE_TTL = 60  # refreshed by heartbeat every 30s


async def set_online(
    uid: str,
    display_name: str,
    is_guest: bool,
    avatar_url: Optional[str] = None,
    gender: Optional[str] = None,
    age: Optional[int] = None,
) -> None:
    r = get_redis()
    await r.hset(
        PRESENCE_KEY.format(uid=uid),
        mapping={
            "display_name": display_name,
            "is_guest": "1" if is_guest else "0",
            # Redis hashes can't hold None, so store "" when there's no value.
            "avatar_url": avatar_url or "",
            "gender": gender or "",
            "age": str(age) if age is not None else "",
            "ts": str(int(time.time())),
        },
    )
    await r.expire(PRESENCE_KEY.format(uid=uid), PRESENCE_TTL)
    await r.sadd("presence:index", uid)


async def refresh_online(uid: str) -> None:
    r = get_redis()
    await r.expire(PRESENCE_KEY.format(uid=uid), PRESENCE_TTL)


async def set_offline(uid: str) -> None:
    r = get_redis()
    await r.delete(PRESENCE_KEY.format(uid=uid))
    await r.srem("presence:index", uid)


async def list_online() -> list[dict]:
    r = get_redis()
    uids = await r.smembers("presence:index")
    out: list[dict] = []
    for raw in uids:
        uid = raw.decode() if isinstance(raw, bytes) else raw
        data = await r.hgetall(PRESENCE_KEY.format(uid=uid))
        if not data:
            await r.srem("presence:index", uid)
            continue
        decoded = {
            (k.decode() if isinstance(k, bytes) else k): (
                v.decode() if isinstance(v, bytes) else v
            )
            for k, v in data.items()
        }
        age_raw = decoded.get("age", "")
        out.append(
            {
                "id": uid,
                "display_name": decoded.get("display_name", "Unknown"),
                "avatar_url": decoded.get("avatar_url") or None,
                "gender": decoded.get("gender") or None,
                "age": int(age_raw) if age_raw else None,
                "is_guest": decoded.get("is_guest") == "1",
            }
        )
    return out


# ---- Photo buffer ----
PHOTO_KEY = "photo_buf:{token}"


async def store_photo(token: str, owner_id: str, recipient_id: str, blob: bytes,
                      content_type: str) -> None:
    r = get_redis()
    key = PHOTO_KEY.format(token=token)
    await r.hset(key, mapping={
        "owner": owner_id,
        "recipient": recipient_id,
        "content_type": content_type,
        "blob": blob,
    })
    await r.expire(key, settings.photo_buffer_ttl_seconds)


async def fetch_photo(token: str) -> Optional[dict]:
    r = get_redis()
    key = PHOTO_KEY.format(token=token)
    data = await r.hgetall(key)
    if not data:
        return None
    return {
        "owner": data[b"owner"].decode(),
        "recipient": data[b"recipient"].decode(),
        "content_type": data[b"content_type"].decode(),
        "blob": data[b"blob"],
    }


async def delete_photo(token: str) -> None:
    r = get_redis()
    await r.delete(PHOTO_KEY.format(token=token))


# ---- User profile cache ----
USER_DATA_KEY = "user_data:{uid}"
USER_DATA_TTL = 300  # 5 minutes


async def get_cached_user_data(uid: str) -> Optional[dict]:
    r = get_redis()
    raw = await r.get(USER_DATA_KEY.format(uid=uid))
    if raw is None:
        return None
    return json.loads(raw.decode() if isinstance(raw, bytes) else raw)


async def set_cached_user_data(uid: str, user) -> None:
    """Cache all profile fields from a User ORM object or CachedUser."""
    r = get_redis()
    data = {
        "id": str(user.id),
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "location": user.location,
        "gender": user.gender,
        "age": user.age,
        "show_gender": user.show_gender,
        "show_age": user.show_age,
        "appear_online": user.appear_online,
        "accent_hue": user.accent_hue,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
    await r.set(USER_DATA_KEY.format(uid=uid), json.dumps(data), ex=USER_DATA_TTL)


async def invalidate_user_cache(uid: str) -> None:
    r = get_redis()
    await r.delete(USER_DATA_KEY.format(uid=uid))


# ---- Rate limiting ----
async def check_rate(key: str, limit: int, window: int = 60) -> bool:
    """Return True if allowed, False if over the limit."""
    r = get_redis()
    current = await r.incr(key)
    if current == 1:
        await r.expire(key, window)
    return current <= limit
