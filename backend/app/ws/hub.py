"""In-process WebSocket connection manager (singleton).

Tracks one active WebSocket per user id and routes server->client messages.
Other modules (notifications, friends) import `manager` to push events.
"""
import asyncio
import json
import logging
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger("ws_hub")


class ConnectionManager:
    def __init__(self) -> None:
        self._conns: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            # Enforce single active session per user.
            existing = self._conns.get(user_id)
            if existing is not None:
                try:
                    await existing.close(code=4000)
                except Exception:
                    pass
            self._conns[user_id] = ws

    async def disconnect(self, user_id: str) -> None:
        async with self._lock:
            self._conns.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self._conns

    async def send_to(self, user_id: str, message: dict) -> bool:
        ws = self._conns.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(message))
            return True
        except Exception as exc:  # pragma: no cover
            logger.warning("send_to %s failed: %s", user_id, exc)
            return False

    async def broadcast(self, message: dict, exclude: set[str] | None = None) -> None:
        exclude = exclude or set()
        for uid, ws in list(self._conns.items()):
            if uid in exclude:
                continue
            try:
                await ws.send_text(json.dumps(message))
            except Exception:  # pragma: no cover
                pass

    @property
    def online_ids(self) -> set[str]:
        return set(self._conns.keys())


manager = ConnectionManager()
