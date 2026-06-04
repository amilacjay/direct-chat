# Starts the backend in "lite mode" (no Docker): SQLite + fakeredis + Kafka off.
$env:USE_FAKE_REDIS = "true"
$env:KAFKA_ENABLED = "false"
$env:MINIO_ENABLED = "false"
$env:DATABASE_URL = "sqlite+aiosqlite:///./dev.db"
$env:DEV_AUTH_ENABLED = "true"
$env:FIELD_ENCRYPTION_KEY = "ZmllbGQtZW5jcnlwdGlvbi1rZXktMzJieXRlcy1kZXY="
$env:FRONTEND_ORIGIN = "http://localhost:5173"
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
