"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    app_name: str = "P2P Chat"
    environment: str = "development"
    frontend_origin: str = "http://localhost:5173"

    # Database
    database_url: str = "postgresql+asyncpg://chat:chat@postgres:5432/chat"

    # Redis
    redis_url: str = "redis://redis:6379/0"
    use_fake_redis: bool = False  # lite mode for local/E2E without Docker

    # Local avatar fallback dir when MinIO is unreachable (lite mode)
    local_avatar_dir: str = "./_avatars"

    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_enabled: bool = True

    # MinIO / object storage
    minio_enabled: bool = True  # set False in lite mode to use local avatar dir
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "avatars"
    minio_secure: bool = False
    minio_public_url: str = "http://localhost:9000"

    # Auth
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    # Encryption for sensitive fields (DOB). 32-byte urlsafe base64 key for Fernet.
    field_encryption_key: str = "ZmllbGQtZW5jcnlwdGlvbi1rZXktMzJieXRlcy1kZXY="

    # Dev/testing auth bypass (lets Playwright log in without real Google).
    # Defaults OFF for safety; lite mode / E2E set DEV_AUTH_ENABLED=true explicitly.
    dev_auth_enabled: bool = False

    # Limits
    max_photo_bytes: int = 5 * 1024 * 1024  # 5MB
    max_avatar_bytes: int = 2 * 1024 * 1024  # 2MB
    photo_buffer_ttl_seconds: int = 60
    rate_msg_per_min: int = 60
    rate_photo_per_min: int = 10

    # WebRTC
    stun_url: str = "stun:stun.l.google.com:19302"
    turn_url: str = "turn:coturn:3478"
    turn_secret: str = "dev-turn-secret"
    turn_realm: str = "p2pchat"

    @property
    def cors_origins(self) -> List[str]:
        return [self.frontend_origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
