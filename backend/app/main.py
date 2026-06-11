"""FastAPI application entrypoint. Wires routers, CORS, and lifecycle."""
import logging
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.database import init_db
from app.kafka import bus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await bus.start_producer()
    logger.info("Application started (env=%s)", settings.environment)
    yield
    # Shutdown
    await bus.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.environment}


# Serve locally-stored avatars (lite mode fallback when MinIO is unavailable).
os.makedirs(settings.local_avatar_dir, exist_ok=True)
app.mount(
    "/avatars",
    StaticFiles(directory=settings.local_avatar_dir),
    name="avatars",
)


# ---- Routers ----
from app.auth.router import router as auth_router  # noqa: E402
from app.users.router import router as users_router  # noqa: E402
from app.friends.router import router as friends_router  # noqa: E402
from app.photos.router import router as photos_router  # noqa: E402
from app.albums.router import router as albums_router  # noqa: E402
from app.notifications.router import router as notifications_router  # noqa: E402
from app.ws.router import router as ws_router  # noqa: E402

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(friends_router, prefix="/friends", tags=["friends"])
app.include_router(photos_router, prefix="/photos", tags=["photos"])
app.include_router(albums_router, prefix="/albums", tags=["albums"])
app.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
app.include_router(ws_router, tags=["ws"])
