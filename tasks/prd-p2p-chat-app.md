# PRD: Peer-to-Peer Chat Application

## Introduction

A production-grade, privacy-first chat application where messages are never stored on the server. Users communicate directly via WebRTC DataChannels (with a WebSocket relay fallback for NAT-traversal failures). The server's only persistent responsibilities are: presence tracking (who is online), friend relationships, user profiles, and ephemeral photo buffering (60s TTL). Guest users get a temporary session-scoped account with text-only access. All registered users must be 18+ and authenticate via Google OAuth2.

---

## Goals

- Deliver real-time P2P messaging with zero message persistence on the server
- Support text messages and photos up to 5MB per message
- Enable users to manage their online/offline visibility
- Provide a friend system with requests, acceptance, and blocking
- Enforce 18+ age verification at registration via date-of-birth + Google account
- Allow guest sessions (text-only, auto-deleted on disconnect)
- Support 1,000–10,000 concurrent users on a single VPS deployment
- Ship as a fully containerized stack via Docker Compose

---

## User Stories

### US-001: Google OAuth2 Registration with Age Verification
**Description:** As a new user, I want to register using my Google account so that I don't need a separate password, and the system verifies I am 18 or older.

**Acceptance Criteria:**
- [ ] "Sign in with Google" button on the landing page initiates OAuth2 flow
- [ ] After Google callback, user is prompted to enter their date of birth if first-time login
- [ ] System calculates age from DOB; if under 18, registration is rejected with a clear message and no account is created
- [ ] If 18+, account is created with Google profile name and avatar as defaults
- [ ] DOB is stored (encrypted at rest) and never displayed publicly
- [ ] Returning users bypass DOB prompt and go directly to the app
- [ ] Typecheck passes

### US-002: Guest Session
**Description:** As a visitor, I want to join as a guest so that I can try the app without creating an account.

**Acceptance Criteria:**
- [ ] "Continue as Guest" option on the landing page
- [ ] Guest gets a server-assigned ephemeral ID and a random display name (e.g., "Guest-4821")
- [ ] Guest session is valid for the browser tab's lifetime; closing the tab destroys the session
- [ ] Guest can only send and receive plain text messages
- [ ] Guest cannot send friend requests, upload photos, or set a profile
- [ ] Guest appears in the online list with a "Guest" badge
- [ ] On disconnect, all server-side session data is deleted immediately
- [ ] Verify in browser using dev-browser skill

### US-003: User Profile Management
**Description:** As a registered user, I want to manage my profile so that others can identify and connect with me.

**Acceptance Criteria:**
- [ ] Profile page shows: display name, avatar photo, bio (max 300 chars), location (optional, text only), join date
- [ ] User can upload a profile photo (JPEG/PNG/WebP, max 2MB); stored in object storage
- [ ] User can update display name (3–30 chars, no special characters except underscores/hyphens)
- [ ] User can update or clear bio and location fields
- [ ] Profile changes save immediately with optimistic UI and a success toast
- [ ] Profile is publicly visible to all logged-in users and friends
- [ ] Verify in browser using dev-browser skill

### US-004: Online / Offline Status Toggle
**Description:** As a registered user, I want to control whether I appear online so that I can have privacy when needed.

**Acceptance Criteria:**
- [ ] Toggle in the header/navbar: "Online" (green dot) / "Appear Offline" (grey dot)
- [ ] When set to Offline, user is removed from the online presence list for all other users
- [ ] User can still use the app and receive messages while appearing offline
- [ ] Status persists across page refreshes (stored in user preferences)
- [ ] Status change is propagated to connected peers within 2 seconds
- [ ] Verify in browser using dev-browser skill

### US-005: Online Users List
**Description:** As a user, I want to see who is currently online so that I can start a conversation.

**Acceptance Criteria:**
- [ ] Sidebar shows a real-time list of online users (registered + guests)
- [ ] Each entry shows avatar, display name, and online badge
- [ ] List updates within 2 seconds of a user joining or leaving
- [ ] Clicking a user opens the chat panel
- [ ] Users who set themselves to "Appear Offline" are not shown
- [ ] Registered users and guests are visually distinct
- [ ] Verify in browser using dev-browser skill

### US-006: Friend Requests
**Description:** As a registered user, I want to send and accept friend requests so that I can build a trusted contacts list.

**Acceptance Criteria:**
- [ ] "Add Friend" button appears on another user's profile and in the online list
- [ ] Sending a request creates a pending notification for the recipient
- [ ] Recipient sees a notification badge and can Accept or Decline
- [ ] On acceptance, both users appear in each other's Friends list
- [ ] On decline, the request is silently discarded; sender is not notified of the decline
- [ ] A user can cancel a pending outgoing request
- [ ] A user can unfriend an existing friend
- [ ] Users cannot send duplicate requests while one is pending
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: WebRTC P2P Text Chat
**Description:** As a registered user, I want to send text messages directly to another user via WebRTC so that messages never touch the server storage.

**Acceptance Criteria:**
- [ ] Opening a chat with an online user initiates a WebRTC offer/answer exchange via the signaling server
- [ ] Once the DataChannel is open, messages are sent directly peer-to-peer
- [ ] Messages appear in the chat UI in real time with timestamp and sender name
- [ ] If WebRTC connection fails (NAT traversal failure detected within 5s), system falls back to WebSocket relay automatically with a subtle "relayed" indicator
- [ ] No message content is written to the server database at any point (relay is in-memory only, transit only)
- [ ] Delivered messages show a ✓ indicator; failed messages show a retry option
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Photo Sharing
**Description:** As a registered user, I want to send photos up to 5MB in a chat so that I can share images with friends.

**Acceptance Criteria:**
- [ ] Photo attachment button in the chat input bar (registered users only)
- [ ] File picker accepts JPEG, PNG, GIF, WebP only; files over 5MB are rejected with an error message
- [ ] Photo is uploaded to the server's ephemeral buffer (Redis with 60s TTL) and a delivery token is generated
- [ ] Token is sent to recipient via the P2P DataChannel or relay
- [ ] Recipient's client fetches the photo using the token within the TTL window
- [ ] After 60s or after successful delivery (whichever comes first), the buffer entry is deleted
- [ ] In-flight photo shows a progress bar; failed uploads show a retry button
- [ ] Guest users see the photo attachment button as disabled with a tooltip "Sign in to send photos"
- [ ] Verify in browser using dev-browser skill

### US-009: WebRTC Signaling Server
**Description:** As a developer, I need a signaling server to broker WebRTC connections between peers without storing message content.

**Acceptance Criteria:**
- [ ] Signaling server accepts WebSocket connections from authenticated clients
- [ ] Routes SDP offers, SDP answers, and ICE candidates between named peers by user ID
- [ ] STUN server configured (use Google's public STUN: `stun:stun.l.google.com:19302`)
- [ ] TURN server configured for relay fallback (coturn deployed as a Docker service)
- [ ] Signaling messages are never logged beyond debug level
- [ ] Handles peer disconnection gracefully (notifies waiting peer)
- [ ] Typecheck passes

### US-010: Notifications
**Description:** As a registered user, I want to receive in-app notifications for friend requests and missed messages so that I don't miss important activity.

**Acceptance Criteria:**
- [ ] Bell icon in header shows unread notification count badge
- [ ] Notifications list shows: friend request received, friend request accepted
- [ ] Clicking a notification navigates to the relevant context (profile page, chat)
- [ ] Notifications are persisted in the database (they are not messages — just events)
- [ ] User can mark all notifications as read
- [ ] Verify in browser using dev-browser skill

### US-011: Block User
**Description:** As a registered user, I want to block another user so that they cannot contact me.

**Acceptance Criteria:**
- [ ] "Block" option available in user profile and chat context menu
- [ ] Blocked user cannot see the blocker in the online list
- [ ] Blocked user cannot send messages or friend requests to the blocker
- [ ] Blocker can view and manage their block list in settings
- [ ] Unblocking restores normal visibility
- [ ] Typecheck passes

---

## Functional Requirements

- **FR-1:** All user authentication MUST use Google OAuth2 (no username/password login).
- **FR-2:** Age verification MUST reject users whose calculated age from DOB is under 18 at registration time; this check is server-side.
- **FR-3:** Guest sessions MUST be ephemeral — all server-side data (session, presence entry) deleted on WebSocket disconnect.
- **FR-4:** Message content (text) MUST NOT be written to any persistent store (database, log files, Kafka topics at rest). Kafka is used for presence events and system events only.
- **FR-5:** Photo data MUST be stored only in Redis with a 60-second TTL; deleted immediately after delivery confirmation or TTL expiry.
- **FR-6:** WebRTC MUST be attempted first for every P2P connection; relay fallback activates only after ICE failure.
- **FR-7:** The TURN relay server (coturn) MUST be deployed as a Docker service within the Compose stack.
- **FR-8:** User presence state (online/offline) MUST be broadcast via Kafka to all connected backend instances (enables future horizontal scaling).
- **FR-9:** All API endpoints (except auth callback and guest init) MUST require a valid JWT.
- **FR-10:** Profile photos MUST be stored in persistent object storage (MinIO deployed in Docker).
- **FR-11:** The system MUST support 1,000–10,000 concurrent WebSocket connections on a single VPS (target: 4 vCPU, 8GB RAM).
- **FR-12:** All inter-service communication MUST use internal Docker network; only the Nginx reverse proxy is exposed externally.
- **FR-13:** HTTPS/WSS MUST be enforced in production; HTTP/WS redirect to HTTPS.
- **FR-14:** Rate limiting MUST be applied: max 60 messages/minute per user, max 10 photo uploads/minute per user.

---

## Non-Goals (Out of Scope)

- Group chats or chat rooms (1-to-1 only in v1)
- Message history / chat archives (by design — nothing is stored)
- Voice or video calls (WebRTC audio/video tracks)
- Mobile native apps (iOS/Android); responsive web only
- End-to-end encryption of the WebSocket relay path (planned for v2)
- Email/SMS notifications
- Push notifications (browser push API)
- Payments or premium tiers
- Admin dashboard / moderation tools
- Read receipts beyond basic delivery confirmation
- Multi-device simultaneous sessions (one active session per user)

---

## Architecture & Technical Design

### System Components

```
┌─────────────────────────────────────────────────────┐
│                    Docker Compose Stack              │
│                                                     │
│  ┌──────────┐    ┌──────────────────────────────┐   │
│  │  Nginx   │    │       React Frontend         │   │
│  │ (reverse │◄───│   (Vite + TypeScript)        │   │
│  │  proxy)  │    └──────────────────────────────┘   │
│  └────┬─────┘                                       │
│       │                                             │
│  ┌────▼──────────────────────────────────────────┐  │
│  │           Python Backend (FastAPI)            │  │
│  │  ┌──────────────┐  ┌───────────────────────┐  │  │
│  │  │  REST API    │  │  WebSocket Server     │  │  │
│  │  │  /auth       │  │  - Signaling (WebRTC) │  │  │
│  │  │  /users      │  │  - Relay fallback     │  │  │
│  │  │  /friends    │  │  - Presence updates   │  │  │
│  │  │  /photos     │  │                       │  │  │
│  │  └──────────────┘  └───────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │PostgreSQL│  │  Redis   │  │     Kafka        │   │
│  │(profiles,│  │(presence,│  │(presence events, │   │
│  │friends,  │  │photo buf,│  │ system events)   │   │
│  │notifs)   │  │sessions) │  │                  │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│                                                     │
│  ┌──────────┐  ┌──────────────────────────────────┐  │
│  │  MinIO   │  │   coturn (TURN/STUN server)      │  │
│  │(profile  │  │   for WebRTC relay fallback      │  │
│  │ photos)  │  │                                  │  │
│  └──────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Service Breakdown

| Service | Image / Tech | Purpose |
|---|---|---|
| `nginx` | nginx:alpine | Reverse proxy, SSL termination, static file serving |
| `frontend` | node:20-alpine (build) | React + Vite SPA, served by Nginx |
| `backend` | python:3.12-slim | FastAPI app: REST + WebSocket |
| `postgres` | postgres:16-alpine | Persistent store: users, profiles, friends, notifications |
| `redis` | redis:7-alpine | Presence map, photo ephemeral buffer, rate limiting counters |
| `kafka` | confluentinc/cp-kafka:7.x | Event bus: presence events, system notifications |
| `zookeeper` | confluentinc/cp-zookeeper | Kafka dependency |
| `minio` | minio/minio | Object storage for profile photos |
| `coturn` | coturn/coturn | TURN server for WebRTC NAT traversal fallback |

### Data Models (PostgreSQL)

```sql
-- Users
users (
  id            UUID PRIMARY KEY,
  google_sub    TEXT UNIQUE NOT NULL,       -- Google subject identifier
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,                       -- MinIO object URL
  bio           TEXT,
  location      TEXT,
  dob           DATE NOT NULL,              -- encrypted at app layer
  appear_online BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)

-- Friendships
friendships (
  id            UUID PRIMARY KEY,
  requester_id  UUID REFERENCES users(id),
  addressee_id  UUID REFERENCES users(id),
  status        TEXT CHECK (status IN ('pending','accepted','blocked')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (requester_id, addressee_id)
)

-- Notifications
notifications (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  type          TEXT,                       -- 'friend_request', 'friend_accepted'
  payload       JSONB,
  read          BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
)
```

### Redis Key Schema

```
presence:{user_id}         → "online" | "offline"  (TTL: refreshed by heartbeat every 30s)
photo_buf:{token}          → binary blob            (TTL: 60s)
rate_msg:{user_id}         → counter                (TTL: 60s window)
rate_photo:{user_id}       → counter                (TTL: 60s window)
session:{session_id}       → guest session data     (TTL: session lifetime)
```

### Kafka Topics

| Topic | Producer | Consumer | Purpose |
|---|---|---|---|
| `user.presence` | Backend WS handler | Backend (all instances) | Broadcast online/offline changes |
| `system.notifications` | Backend REST | Backend WS handler | Deliver notifications to connected user |

### WebRTC Connection Flow

```
Peer A (Caller)          Signaling Server           Peer B (Callee)
     │                         │                         │
     │── WS connect ──────────►│                         │
     │                         │◄──── WS connect ────────│
     │── offer (SDP) ─────────►│                         │
     │                         │──── offer (SDP) ───────►│
     │                         │◄─── answer (SDP) ───────│
     │◄── answer (SDP) ────────│                         │
     │── ICE candidates ───────►│──── ICE candidates ────►│
     │◄─────────────────────────│◄─── ICE candidates ─────│
     │                         │                         │
     │◄════════ WebRTC DataChannel (P2P) ════════════════►│
     │                         │                         │
     │  (if ICE fails after 5s — fallback to WS relay)   │
     │── relay msg ───────────►│──── relay msg ─────────►│
```

### Photo Transfer Flow

```
Sender                  Backend (Redis Buffer)           Receiver
  │                             │                            │
  │── POST /photos/upload ─────►│                            │
  │                             │ store blob, TTL=60s        │
  │◄── {token, expires_at} ─────│                            │
  │                             │                            │
  │── DataChannel: {token} ─────────────────────────────────►│
  │                             │                            │
  │                             │◄── GET /photos/{token} ────│
  │                             │── return blob, delete ────►│
  │                             │                            │
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/auth/google` | Initiate Google OAuth2 flow |
| GET | `/auth/google/callback` | Handle OAuth2 callback, issue JWT |
| POST | `/auth/guest` | Create ephemeral guest session, return JWT |
| POST | `/auth/logout` | Invalidate session |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Get own profile |
| PATCH | `/users/me` | Update display name, bio, location, appear_online |
| POST | `/users/me/avatar` | Upload profile photo |
| GET | `/users/{id}` | Get public profile of another user |
| GET | `/users/online` | List currently online users |

### Friends
| Method | Path | Description |
|---|---|---|
| POST | `/friends/request/{user_id}` | Send friend request |
| POST | `/friends/accept/{request_id}` | Accept friend request |
| DELETE | `/friends/decline/{request_id}` | Decline friend request |
| DELETE | `/friends/{user_id}` | Unfriend |
| POST | `/friends/block/{user_id}` | Block a user |
| DELETE | `/friends/block/{user_id}` | Unblock |
| GET | `/friends` | List accepted friends |
| GET | `/friends/requests` | List pending incoming requests |

### Photos
| Method | Path | Description |
|---|---|---|
| POST | `/photos/upload` | Upload photo to ephemeral buffer; returns token |
| GET | `/photos/{token}` | Fetch photo by token (single-use or until TTL) |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List notifications for current user |
| POST | `/notifications/read-all` | Mark all as read |

### WebSocket
| Path | Description |
|---|---|
| `wss://host/ws` | Multiplex: signaling, relay, presence, notifications |

---

## Frontend Architecture

### Tech Stack
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Zustand** (client state: auth, presence, friends)
- **React Query / TanStack Query** (server state: profile, notifications)
- **simple-peer** or native `RTCPeerConnection` (WebRTC)
- **Tailwind CSS** (styling)
- **React Router v6** (routing)

### Key Pages / Routes

| Route | Component | Auth Required |
|---|---|---|
| `/` | Landing (Sign in / Guest) | No |
| `/app` | Main layout with sidebar + chat | Yes (any) |
| `/app/chat/:userId` | Chat panel | Yes (any) |
| `/app/profile` | Own profile editor | Registered only |
| `/app/profile/:userId` | View another's profile | Yes (any) |
| `/app/friends` | Friends list + requests | Registered only |
| `/app/settings` | Preferences, block list | Registered only |

---

## Docker Compose Structure

```
project-root/
├── docker-compose.yml
├── docker-compose.prod.yml        # overrides for production
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                # FastAPI app entry
│   │   ├── config.py
│   │   ├── auth/
│   │   ├── users/
│   │   ├── friends/
│   │   ├── photos/
│   │   ├── notifications/
│   │   ├── ws/                    # WebSocket hub, signaling, relay
│   │   ├── kafka/
│   │   └── db/
│   └── alembic/                   # DB migrations
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── store/
│       └── lib/
│           ├── webrtc.ts
│           └── websocket.ts
├── nginx/
│   ├── nginx.conf
│   └── Dockerfile
└── coturn/
    └── turnserver.conf
```

### docker-compose.yml (key services)

```yaml
version: "3.9"
services:
  nginx:
    build: ./nginx
    ports: ["80:80", "443:443"]
    depends_on: [backend, frontend]

  frontend:
    build: ./frontend
    environment:
      - VITE_API_URL=https://yourdomain.com

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql+asyncpg://...
      - REDIS_URL=redis://redis:6379
      - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
      - GOOGLE_CLIENT_ID=...
      - GOOGLE_CLIENT_SECRET=...
      - JWT_SECRET=...
      - MINIO_ENDPOINT=minio:9000
    depends_on: [postgres, redis, kafka, minio]

  postgres:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [minio_data:/data]

  coturn:
    image: coturn/coturn
    ports: ["3478:3478/udp", "3478:3478/tcp"]
    volumes: [./coturn/turnserver.conf:/etc/coturn/turnserver.conf]
```

---

## Security Requirements

- **SR-1:** Google OAuth2 tokens MUST be validated server-side on every request (no client-trust).
- **SR-2:** JWTs MUST use RS256 (asymmetric) with 1-hour expiry; refresh tokens stored in httpOnly cookies.
- **SR-3:** DOB stored using application-level encryption (AES-256-GCM) before writing to Postgres.
- **SR-4:** Photo upload endpoint MUST validate MIME type by reading file magic bytes, not just extension.
- **SR-5:** TURN server credentials MUST be time-limited and generated per-session (coturn supports this natively).
- **SR-6:** All environment secrets MUST be provided via `.env` files excluded from git; `.env.example` committed.
- **SR-7:** CORS policy MUST whitelist only the frontend origin.
- **SR-8:** WebSocket connections MUST authenticate via JWT in the connection handshake (not URL params).
- **SR-9:** Users MUST NOT be able to fetch a photo buffer token that was not addressed to them.

---

## Non-Functional Requirements

| Attribute | Requirement |
|---|---|
| Concurrent connections | 10,000 WebSocket connections on a 4 vCPU / 8GB VPS |
| Signaling latency | SDP exchange completes in < 500ms on LAN |
| Photo upload | 5MB upload completes in < 10s on 10Mbps connection |
| API response time | 95th percentile < 200ms for REST endpoints |
| Presence propagation | Online/offline status visible to peers within 2s |
| Photo TTL enforcement | Buffer entries deleted within 5s of TTL expiry |
| Uptime | 99.5% (single VPS; no HA in v1) |

---

## Success Metrics

- WebRTC DataChannel established (no relay) for > 70% of connections
- Photo delivery within TTL window for > 99% of transfers
- Zero messages recoverable from server storage after delivery (audit)
- Guest session data fully purged within 5 seconds of disconnect
- Age-verification bypass rate: 0% (server-side enforcement)

---

## Open Questions

1. Should users be able to report/flag other users? (Moderation is out of scope for v1 but worth noting.)
2. Should the TURN server credentials be rotated automatically, or is a static secret acceptable for v1?
3. Is a single Kafka partition per topic sufficient for v1, or should we plan for topic partitioning from day one?
4. Should guest users be able to see the online user list, or only registered users?
5. Is there a preferred Let's Encrypt / Certbot integration method, or will SSL certs be managed externally?

---

## Implementation Order (Suggested)

1. **Foundation:** Docker Compose stack up with all services healthy
2. **Auth:** Google OAuth2 flow + JWT issuance + age verification
3. **Guest sessions:** Ephemeral session creation and cleanup
4. **Presence:** WebSocket hub, Redis presence map, Kafka broadcast
5. **Online users list:** REST + real-time updates
6. **Profiles:** CRUD + MinIO photo upload
7. **Friends:** Request, accept, decline, block flows
8. **Signaling:** WebRTC offer/answer/ICE via WebSocket
9. **P2P text chat:** DataChannel messaging + UI
10. **Relay fallback:** WebSocket relay for failed WebRTC
11. **Photo sharing:** Upload → Redis buffer → token → fetch flow
12. **Notifications:** In-app notification delivery
13. **Rate limiting:** Redis-backed per-user limits
14. **Hardening:** Security audit, CORS, HTTPS, TURN credential rotation
