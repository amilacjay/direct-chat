"""JWT issuance/verification and field-level encryption for sensitive data."""
import base64
from datetime import date, datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt

from app.config import settings


def _fernet() -> Fernet:
    # field_encryption_key must be a urlsafe base64-encoded 32-byte key.
    key = settings.field_encryption_key
    # Allow plain 32-char keys by encoding them.
    try:
        base64.urlsafe_b64decode(key)
        return Fernet(key)
    except Exception:
        padded = base64.urlsafe_b64encode(key.encode().ljust(32, b"0")[:32])
        return Fernet(padded)


def encrypt_field(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_field(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()


def create_access_token(
    subject: str, is_guest: bool, extra: dict[str, Any] | None = None
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "guest": is_guest,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_ttl_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError as exc:  # pragma: no cover - re-raised as auth error upstream
        raise ValueError("invalid token") from exc


def calculate_age(dob: date, today: date | None = None) -> int:
    today = today or date.today()
    return (
        today.year
        - dob.year
        - ((today.month, today.day) < (dob.month, dob.day))
    )


def is_adult(dob: date) -> bool:
    return calculate_age(dob) >= 18
