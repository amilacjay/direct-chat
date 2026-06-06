"""In-process WebSocket connection manager (singleton).

Tracks all active WebSocket sessions per user id and routes server->client
messages. Multiple simultaneous sessions (e.g. mobile + desktop) are
supported: join/leave presence events are only broadcast when the first
session opens or the last one closes.
"""
import asyncio
import json
import logging
from typing import Dict, List

from fastapi import WebSocket

logger = logging.getLogger("ws_hub")


class ConnectionManager:
    def __init__(self) -> None:
        # uid -> list of active WebSockets (ordered by connect time, oldest first)
        self._conns: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> bool:
        """Accept websocket and register it.

        Returns True if this is the user's *first* active session (i.e. they
        were not already online), so the caller knows whether to broadcast a
        presence 'join' event.
        """
        await ws.accept()
        async with self._lock:
            sessions = self._conns.setdefault(user_id, [])
            is_first = len(sessions) == 0
            sessions.append(ws)
            return is_first

    async def disconnect(self, user_id: str, ws: WebSocket) -> bool:
        """Remove a specific websocket session.

        Returns True if this was the user's *last* active session (i.e. they
        are now fully offline), so the caller knows whether to broadcast a
        presence 'leave' event.
        """
        async with self._lock:
            sessions = self._conns.get(user_id)
            if sessions is not None:
                try:
                    sessions.remove(ws)
                except ValueError:
                    pass
                if not sessions:
                    del self._conns[user_id]
                    return True  # last session gone
            return False  # other sessions remain

    def is_online(self, user_id: str) -> bool:
        return bool(self._conns.get(user_id))

    def session_count(self, user_id: str) -> int:
        return len(self._conns.get(user_id, []))

    async def send_to(self, user_id: str, message: dict) -> bool:
        """Send to the user's most recently connected session.

        For P2P signalling and relay the most-recent session is the active one.
        """
        sessions = self._conns.get(user_id)
        if not sessions:
            return False
        text = json.dumps(message)
        for ws in reversed(sessions):
            try:
                await ws.send_text(text)
                return True
            except Exception:
                pass
        return False

    async def broadcast(self, message: dict, exclude: set[str] | None = None) -> None:
        """Send to every user's most-recent session (once per user)."""
        exclude = exclude or set()
        text = json.dumps(message)
        for uid, sessions in list(self._conns.items()):
            if uid in exclude:
                continue
            for ws in reversed(sessions):
                try:
                    await ws.send_text(text)
                    break
                except Exception:
                    pass

    @property
    def online_ids(self) -> set[str]:
        return set(self._conns.keys())


manager = ConnectionManager()
