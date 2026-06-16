"""WebSocket router: /ws endpoint and GET /rtc-config."""
import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.config import settings
from app.core.deps import Principal, get_current_principal
from app.core.security import decode_token
from app.db.database import SessionLocal
from app.db.models import User
from app.redis_client import (
    check_rate,
    clear_location,
    list_online,
    refresh_online,
    set_location,
    set_offline,
    set_online,
)
from app.schemas import IceServer, RtcConfig
from app.ws.hub import manager

router = APIRouter()


@router.get("/rtc-config", response_model=RtcConfig)
async def rtc_config(principal: Principal = Depends(get_current_principal)):
    """Return ICE server configuration for WebRTC, including TURN credentials."""
    ice_servers: list[IceServer] = [IceServer(urls=settings.stun_url)]

    if settings.turn_secret:
        username = f"{int(time.time()) + 3600}:{principal.id}"
        credential = base64.b64encode(
            hmac.new(
                settings.turn_secret.encode(),
                username.encode(),
                hashlib.sha1,
            ).digest()
        ).decode()
        ice_servers.append(
            IceServer(
                urls=settings.turn_url,
                username=username,
                credential=credential,
            )
        )

    return RtcConfig(ice_servers=ice_servers)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for presence and signalling."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.close(code=4401)
        return

    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.accept()
        await websocket.close(code=4401)
        return

    sub: str = payload.get("sub", "")
    is_guest: bool = bool(payload.get("guest", False))

    if not sub:
        await websocket.accept()
        await websocket.close(code=4401)
        return

    # Resolve display_name and appear_online for registered users
    display_name: str = payload.get("name", "Guest" if is_guest else "User")
    appear_online: bool = True
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    accent_hue: Optional[int] = None
    db_user: Optional[User] = None

    if not is_guest:
        # Load user from DB for display_name and appear_online setting
        try:
            from sqlalchemy import select as sa_select
            async with SessionLocal() as db:
                result = await db.execute(
                    sa_select(User).where(User.id == uuid.UUID(str(sub)))
                )
                db_user = result.scalar_one_or_none()
                if db_user is not None:
                    display_name = db_user.display_name
                    appear_online = db_user.appear_online
                    avatar_url = db_user.avatar_url
                    gender = db_user.gender if db_user.show_gender else None
                    age = db_user.age if db_user.show_age else None
                    accent_hue = db_user.accent_hue
        except Exception:
            pass
    else:
        # Guests carry their (optional) gender/age in the token claims.
        gender = payload.get("gender")
        age = payload.get("age")

    uid = sub

    is_first_session = await manager.connect(uid, websocket)

    try:
        if appear_online:
            # Always refresh presence data; only announce to others on first session.
            await set_online(uid, display_name, is_guest, avatar_url, gender, age)
            if is_first_session:
                await manager.broadcast(
                    {
                        "type": "presence",
                        "data": {
                            "event": "join",
                            "user": {
                                "id": uid,
                                "display_name": display_name,
                                "avatar_url": avatar_url,
                                "gender": gender,
                                "age": age,
                                "is_guest": is_guest,
                            },
                        },
                    },
                    exclude={uid},
                )

        # Send presence snapshot to this socket
        all_online = await list_online()
        snapshot_users = [u for u in all_online if u["id"] != uid]
        await websocket.send_text(
            json.dumps(
                {
                    "type": "presence",
                    "data": {
                        "event": "snapshot",
                        "users": snapshot_users,
                    },
                }
            )
        )

        # Message loop
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except (json.JSONDecodeError, ValueError):
                await websocket.send_text(
                    json.dumps({"type": "error", "data": {"message": "invalid_json"}})
                )
                continue

            msg_type = data.get("type")

            if msg_type == "signal":
                target = data.get("to")
                if target:
                    await manager.send_to(
                        target,
                        {"type": "signal", "from": uid, "data": data.get("data")},
                    )

            elif msg_type == "relay":
                target = data.get("to")
                if not target:
                    continue
                allowed = await check_rate(f"rate_msg:{uid}", settings.rate_msg_per_min)
                if not allowed:
                    await websocket.send_text(
                        json.dumps({"type": "error", "data": {"message": "rate_limited"}})
                    )
                else:
                    await manager.send_to(
                        target,
                        {"type": "relay", "from": uid, "data": data.get("data")},
                    )

            elif msg_type == "presence_set":
                if is_guest:
                    # Guests cannot change presence
                    continue
                appear_data = data.get("data", {})
                new_appear = bool(appear_data.get("appear_online", True))

                # Persist to DB
                try:
                    from sqlalchemy import select as sa_select
                    async with SessionLocal() as db:
                        result = await db.execute(
                            sa_select(User).where(User.id == uuid.UUID(str(uid)))
                        )
                        db_user_inner = result.scalar_one_or_none()
                        if db_user_inner is not None:
                            db_user_inner.appear_online = new_appear
                            await db.commit()
                except Exception:
                    pass

                appear_online = new_appear
                if new_appear:
                    await set_online(uid, display_name, is_guest, avatar_url, gender, age)
                    await manager.broadcast(
                        {
                            "type": "presence",
                            "data": {
                                "event": "join",
                                "user": {
                                    "id": uid,
                                    "display_name": display_name,
                                    "avatar_url": avatar_url,
                                    "gender": gender,
                                    "age": age,
                                    "is_guest": is_guest,
                                },
                            },
                        },
                        exclude={uid},
                    )
                else:
                    await set_offline(uid)
                    await manager.broadcast(
                        {
                            "type": "presence",
                            "data": {"event": "leave", "id": uid},
                        },
                        exclude={uid},
                    )

            elif msg_type == "location_update":
                loc_data = data.get("data", {})
                try:
                    lat = float(loc_data["lat"])
                    lng = float(loc_data["lng"])
                except (KeyError, TypeError, ValueError):
                    continue
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    continue
                await set_location(uid, lat, lng, display_name, is_guest, avatar_url, accent_hue)

            elif msg_type == "location_off":
                await clear_location(uid)

            elif msg_type == "ping":
                await refresh_online(uid)
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        is_last_session = await manager.disconnect(uid, websocket)
        if is_last_session:
            await set_offline(uid)
            await clear_location(uid)
            await manager.broadcast(
                {
                    "type": "presence",
                    "data": {"event": "leave", "id": uid},
                },
                exclude={uid},
            )
