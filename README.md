# Direct — P2P Chat App

Privacy-first peer-to-peer chat. Messages travel directly between browsers via WebRTC DataChannels; nothing is stored on the server. The WebSocket signaling server handles presence, friend events, and relay fallback only.

---

## Running locally (lite mode, no Docker)

Lite mode replaces Postgres with SQLite, Redis with an in-process fake, and disables Kafka so you can iterate quickly without Docker.

### 1. Backend

From the `backend/` directory:

```powershell
# PowerShell — set env vars then start uvicorn
$env:USE_FAKE_REDIS       = "true"
$env:KAFKA_ENABLED        = "false"
$env:DATABASE_URL         = "sqlite+aiosqlite:///./dev.db"
$env:DEV_AUTH_ENABLED     = "true"

uvicorn app.main:app --port 8000 --reload
```

The backend will be available at `http://localhost:8000`.  
`/auth/dev-login` is enabled so Playwright (and manual testing) can create accounts without Google OAuth.

### 2. Frontend

From the `frontend/` directory:

```powershell
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173` and proxies nothing — it calls the backend directly at `http://localhost:8000`.

### 3. Running E2E tests (Playwright)

With both servers running:

```powershell
cd e2e
npm install
npx playwright install chromium
npm test
```

See `e2e/README.md` for full details.

---

## Running full stack (Docker)

```powershell
# 1. Copy the example env file and fill in real values
Copy-Item .env.example .env
# Edit .env — at minimum set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, POSTGRES_PASSWORD

# 2. Build and start all services
docker compose up --build

# 3. Open the app
Start-Process "http://localhost"
```

Services exposed:

| URL | Service |
|---|---|
| `http://localhost` | Nginx (frontend + API proxy) |
| `http://localhost:9001` | MinIO admin console |
| `udp/tcp :3478` | coturn TURN server |

To tear down (keeping volumes):

```powershell
docker compose down
```

To tear down and wipe all data:

```powershell
docker compose down -v
```

---

## Architecture overview

See `tasks/prd-p2p-chat-app.md` for the full product spec and `CONTRACT.md` for the backend–frontend API contract.

```
Browser ──► Nginx ──► frontend (nginx:alpine, React SPA)
                 └──► backend  (FastAPI, uvicorn)
                          ├── PostgreSQL 16  (users, friends, notifications)
                          ├── Redis 7        (presence, photo buffer, rate limits)
                          ├── Kafka          (presence events, system notifications)
                          └── MinIO          (profile photos)
                 ──► coturn (TURN relay for WebRTC NAT traversal)
```
