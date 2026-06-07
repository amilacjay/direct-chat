# Direct — P2P Chat App

Privacy-first peer-to-peer chat. Messages travel directly between browsers via WebRTC DataChannels; nothing is stored on the server. The WebSocket signaling server handles presence, friend events, and relay fallback only.

The server's only persistent state is users, friend relationships, profiles, and notifications (Postgres), plus ephemeral presence/photo buffers (Redis) and profile photos (MinIO).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React SPA (Vite), served by nginx:alpine |
| Backend | FastAPI + uvicorn (async), SQLAlchemy 2.0 async, Alembic |
| Database | PostgreSQL 16 |
| Cache / presence | Redis 7 |
| Events | Kafka (+ Zookeeper) |
| Object storage | MinIO (S3-compatible) |
| WebRTC NAT traversal | coturn (STUN/TURN) |
| Reverse proxy | Nginx |
| E2E tests | Playwright |

---

## Repository layout

```
.
├── docker-compose.yml          # full stack (HTTP)
├── .env.example                # copy to .env and fill in
├── nginx/                      # reverse proxy (frontend + API)
├── frontend/                   # React SPA (Vite)
│   ├── .env.development        # committed Vite build vars (dev)
│   └── .env.production         # committed Vite build vars (prod)
├── backend/                    # FastAPI app
│   ├── app/                    # application code (auth, friends, ws, ...)
│   ├── alembic/                # migration environment
│   │   └── versions/           # migration scripts
│   ├── alembic.ini
│   ├── run-lite.ps1            # start backend without Docker (SQLite + fakeredis)
│   └── requirements.txt
├── coturn/                     # TURN server config
├── e2e/                        # Playwright end-to-end tests
└── tasks/prd-p2p-chat-app.md   # full product spec
```

See `CONTRACT.md` for the backend↔frontend API contract.

---

## Running locally (lite mode, no Docker)

Lite mode replaces Postgres with SQLite, Redis with an in-process fake, and disables Kafka/MinIO so you can iterate quickly without Docker.

### 1. Backend

From the `backend/` directory, the easiest path is the helper script (creates the env, sets all lite-mode vars):

```powershell
# one-time: create a virtualenv and install deps
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# start the backend in lite mode (SQLite + fakeredis + Kafka/MinIO off)
.\run-lite.ps1
```

Or set the env vars yourself and run uvicorn directly:

```powershell
$env:USE_FAKE_REDIS   = "true"
$env:KAFKA_ENABLED    = "false"
$env:MINIO_ENABLED    = "false"
$env:DATABASE_URL     = "sqlite+aiosqlite:///./dev.db"
$env:DEV_AUTH_ENABLED = "true"

uvicorn app.main:app --port 8000 --reload
```

The backend is available at `http://localhost:8000`.
`POST /auth/dev-login` is enabled so Playwright (and manual testing) can create accounts without Google OAuth.

> **Note:** In lite mode SQLite tables are created from the models on startup, so you do **not** need to run Alembic. Alembic is only required against Postgres (see [Database migrations](#database-migrations-alembic)).

### 2. Frontend

From the `frontend/` directory:

```powershell
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173` and calls the backend directly at `http://localhost:8000`.

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
# Edit .env — at minimum set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
# JWT_SECRET, POSTGRES_PASSWORD

# 2. Build and start all services
docker compose up --build -d

# 3. Apply database migrations (first run + after any schema change)
docker compose run --rm migrate

# 4. Open the app
Start-Process "http://localhost"
```

Services exposed on the host:

| URL | Service |
|---|---|
| `http://localhost` | Nginx (frontend + API proxy) |
| `http://localhost:9001` | MinIO admin console |
| `http://127.0.0.1:8080` | Adminer (DB browser, opt-in — see below) |
| `udp/tcp :3478` | coturn TURN server |

Tear down (keep data volumes):

```powershell
docker compose down
```

Tear down and wipe **all** data (Postgres + MinIO):

```powershell
docker compose down -v
```

> **TLS:** SSL is **not** terminated by Docker. Run TLS in front of the stack (load balancer, Cloudflare, or a host nginx) and point it at `http://localhost`.

---

## Database migrations (Alembic)

Schema is managed with Alembic. Migration scripts live in [backend/alembic/versions/](backend/alembic/versions/). The Alembic env ([backend/alembic/env.py](backend/alembic/env.py)) reads the connection string from the `DATABASE_URL` environment variable — the `sqlalchemy.url` in `alembic.ini` is just a placeholder.

### Applying migrations (Docker)

A dedicated `migrate` service runs `alembic upgrade head` against the Postgres container. Run it after starting the stack and after pulling any change that adds a migration:

```powershell
docker compose run --rm migrate
```

### Creating a new migration

After changing the SQLAlchemy models in [backend/app/db/models.py](backend/app/db/models.py), autogenerate a migration. Alembic needs a live Postgres to diff against, so start the DB first:

```powershell
# make sure Postgres is up
docker compose up -d postgres

# autogenerate a new revision (run from the backend/ directory)
$env:DATABASE_URL = "postgresql+asyncpg://chat:<POSTGRES_PASSWORD>@localhost:5432/chatdb"
alembic revision --autogenerate -m "describe your change"
```

> The compose Postgres service does **not** publish port 5432 by default. To run Alembic from your host against it, either add a `ports: ["5432:5432"]` mapping to the `postgres` service temporarily, or run Alembic inside the container:
> ```powershell
> docker compose run --rm migrate alembic revision --autogenerate -m "describe your change"
> ```

**Always review the generated script** in `backend/alembic/versions/` before committing — autogenerate misses some changes (renames, server defaults, enum edits) and may need hand-editing.

### Common Alembic commands

Run these from `backend/` with `DATABASE_URL` set, or prefix with `docker compose run --rm migrate` to run inside the container:

```powershell
alembic upgrade head          # apply all pending migrations
alembic downgrade -1          # roll back the last migration
alembic current               # show the currently applied revision
alembic history --verbose     # list all revisions
alembic stamp head            # mark DB as up-to-date without running migrations
```

---

## Adminer — browse the database from your browser

Adminer is a lightweight web DB client, useful for inspecting/editing the Postgres database as an admin. It is **opt-in** (behind the compose `tools` profile) and **bound to `127.0.0.1` only** — it is never exposed to the public internet.

### Start it

```powershell
docker compose --profile tools up -d adminer
```

### Connect

| Local machine | Remote server |
|---|---|
| Open `http://localhost:8080` | First open an SSH tunnel, then browse to `http://localhost:8080` locally |

For a remote server, tunnel the port from your laptop:

```powershell
ssh -L 8080:127.0.0.1:8080 user@your-server
```

### Login fields

| Field | Value |
|---|---|
| System | PostgreSQL |
| Server | `postgres` (pre-filled) |
| Username | your `POSTGRES_USER` (default `chat`) |
| Password | your `POSTGRES_PASSWORD` (from `.env`) |
| Database | your `POSTGRES_DB` (default `chatdb`, pre-filled) |

### Stop it

```powershell
docker compose --profile tools stop adminer
```

---

## MinIO console

Profile photos are stored in MinIO. The admin console is published at `http://localhost:9001`.

Log in with `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` from your `.env` (defaults `minioadmin` / `minioadmin`). The `MINIO_BUCKET` (default `avatars`) holds uploaded images; nginx proxies `/avatars/` to MinIO so URLs are served same-origin.

---

## Environment variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

### Backend / infrastructure (`.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | yes | — | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | yes | — | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | no | `http://localhost/auth/google/callback` | Must match the authorised redirect URI in the Google console |
| `JWT_SECRET` | yes | — | Signing key for access tokens (`python -c "import secrets; print(secrets.token_hex(32))"`) |
| `POSTGRES_USER` | no | `chat` | Postgres user |
| `POSTGRES_PASSWORD` | yes | — | Postgres password |
| `POSTGRES_DB` | no | `chatdb` | Postgres database name |
| `MINIO_ACCESS_KEY` | no | `minioadmin` | MinIO root user |
| `MINIO_SECRET_KEY` | no | `minioadmin` | MinIO root password |
| `MINIO_BUCKET` | no | `avatars` | Bucket for profile photos |
| `TURN_SECRET` | no | `dev-turn-secret` | Must match `static-auth-secret` in `coturn/turnserver.conf` |
| `FRONTEND_ORIGIN` | no | `http://localhost` | Allowed CORS origin; set to your domain in prod |
| `FIELD_ENCRYPTION_KEY` | no | dev key | 32-byte url-safe base64 Fernet key for encrypting sensitive fields (DOB). **Set a fresh key in production.** |
| `DEV_AUTH_ENABLED` | no | `false` | Exposes `POST /auth/dev-login`. **Never enable in production.** |

Lite-mode-only toggles (set by `run-lite.ps1`, not needed for Docker): `USE_FAKE_REDIS`, `KAFKA_ENABLED`, `MINIO_ENABLED`, `DATABASE_URL`.

### Frontend build-time (`frontend/.env.*`)

Vite bakes `VITE_*` vars into the bundle **at build time** — changing one requires a frontend rebuild. These files are committed.

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend origin (`''` = same-origin behind nginx) |
| `VITE_DEV_AUTH` | `'true'` shows the dev-login form on the landing page |
| `VITE_DONATE_XMR` | Monero donation address (empty = hide XMR) |
| `VITE_DONATE_BTC` | Bitcoin donation address (empty = hide BTC) |

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

Messages themselves never touch the server — once two peers are connected via WebRTC, chat and photos flow browser-to-browser. The WebSocket relay is only a fallback when NAT traversal fails.
