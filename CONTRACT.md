# Integration Contract (Backend ↔ Frontend ↔ Tests)

This file is the single source of truth for the API and WebSocket protocol.
All agents MUST conform to this exactly. Do not invent different paths/shapes.

Base URLs (local dev):
- Backend REST + WS: `http://localhost:8000`
- Frontend (Vite dev): `http://localhost:5173`

Auth: `Authorization: Bearer <jwt>` header on all REST calls except `/health`,
`/auth/*`. WebSocket auth uses `?token=<jwt>` query param (browsers can't set WS headers).

---

## REST Endpoints

### Auth (`/auth`)
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/auth/google` | none | — | 302 redirect to Google consent |
| GET | `/auth/google/callback?code=` | none | — | 302 redirect to frontend `/login/callback?token=...&new=0/1` |
| POST | `/auth/complete-registration` | pending-bearer | `{dob:"YYYY-MM-DD"}` | `TokenResponse` or 403 if <18 |
| POST | `/auth/guest` | none | — | `TokenResponse` (is_guest=true) |
| POST | `/auth/dev-login` | none (dev only) | `{email, display_name, dob}` | `TokenResponse` (creates/gets registered user; 403 if <18) |
| POST | `/auth/logout` | bearer | — | `{ok:true}` |

`TokenResponse` = `{access_token, token_type:"bearer", is_guest:bool, user:PublicUser}`

### Users (`/users`)
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/users/me` | any | — | `PublicUser` |
| PATCH | `/users/me` | registered | `UpdateProfile` | `PublicUser` |
| POST | `/users/me/avatar` | registered | multipart `file` | `PublicUser` |
| GET | `/users/{id}` | any | — | `PublicUser` (404 if missing) |
| GET | `/users/online` | any | — | `OnlineUser[]` (excludes self & appear-offline) |

### Friends (`/friends`) — all registered-only
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/friends/request/{user_id}` | — | 201 `{ok:true}` |
| POST | `/friends/accept/{request_id}` | — | `{ok:true}` |
| DELETE | `/friends/decline/{request_id}` | — | 204 |
| DELETE | `/friends/{user_id}` | — | 204 (unfriend) |
| POST | `/friends/block/{user_id}` | — | `{ok:true}` |
| DELETE | `/friends/block/{user_id}` | — | 204 |
| GET | `/friends` | — | `Friend[]` |
| GET | `/friends/requests` | — | `FriendRequest[]` (incoming pending) |

### Photos (`/photos`) — registered-only
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/photos/upload` | multipart `file` + form `to`=recipientId | `{token, expires_at}` |
| GET | `/photos/{token}` | — | image bytes (only recipient/owner); 404 expired; deleted after fetch |

Reject files >5MB (photos) / >2MB (avatar). Validate by magic bytes. Allowed: jpeg,png,gif,webp.

### Notifications (`/notifications`) — registered-only
| Method | Path | Returns |
|---|---|---|
| GET | `/notifications` | `NotificationOut[]` (newest first) |
| POST | `/notifications/read-all` | `{ok:true}` |

### WebRTC config
| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/rtc-config` | any | `{ice_servers:[{urls,username?,credential?}]}` |

---

## JSON Shapes

```ts
PublicUser   = { id:string, display_name:string, avatar_url?:string|null,
                 bio?:string|null, location?:string|null, is_guest:boolean,
                 created_at?:string|null }
UpdateProfile= { display_name?:string, bio?:string, location?:string, appear_online?:boolean }
OnlineUser   = { id:string, display_name:string, avatar_url?:string|null, is_guest:boolean }
FriendRequest= { id:string, requester:PublicUser, created_at:string }
Friend       = { user:PublicUser, friendship_id:string }
NotificationOut = { id:string, type:string, payload:object, read:boolean, created_at:string }
```

display_name rule: 3–30 chars, `^[A-Za-z0-9 _-]+$`.

---

## WebSocket Protocol (`ws://localhost:8000/ws?token=JWT`)

All frames are JSON. Envelope: `{ type, to?, from?, data? }`.

### Server → Client
- Presence snapshot (sent once on connect):
  `{type:"presence", data:{event:"snapshot", users:OnlineUser[]}}`
- Presence join: `{type:"presence", data:{event:"join", user:OnlineUser}}`
- Presence leave: `{type:"presence", data:{event:"leave", id:string}}`
- Signal relay: `{type:"signal", from:string, data:<sdp-or-ice-payload>}`
- Text relay (fallback): `{type:"relay", from:string, data:{text:string, ts:number}}`
- Notification: `{type:"notification", data:NotificationOut}`
- Error: `{type:"error", data:{message:string}}`
- Pong: `{type:"pong"}`

### Client → Server
- Signal: `{type:"signal", to:string, data:<sdp-or-ice>}`  (caller/callee SDP & ICE)
- Text relay: `{type:"relay", to:string, data:{text:string, ts:number}}` (rate-limited 60/min)
- Set presence: `{type:"presence_set", data:{appear_online:boolean}}` (registered only)
- Ping (heartbeat ~25s): `{type:"ping"}`

Guests: may send `signal` and `relay` (text). Guests may NOT upload photos
(server rejects at `/photos/upload` with 403). Photo send flow: sender uploads to
`/photos/upload` → gets `token` → sends `{type:"relay"|datachannel, data:{photo_token, ...}}`
to peer → peer GETs `/photos/{token}`.

### WebRTC P2P text flow (primary)
1. Both peers connect WS.
2. Caller creates RTCPeerConnection + DataChannel, sends offer via `signal`.
3. Callee answers via `signal`; ICE candidates exchanged via `signal`.
4. On DataChannel open → send chat text directly (NOT via server).
5. If ICE fails / no connection within 5s → fall back to `{type:"relay"}` over WS.
   UI shows a small "relayed" indicator on relayed messages.

---

## Dev/Test Login (Playwright)
`POST /auth/dev-login {email, display_name, dob:"YYYY-MM-DD"}` returns a real
`TokenResponse`. Frontend route `/login/callback?token=...` stores token and enters app.
For tests, the frontend should also accept a token via `localStorage['auth_token']`
being set before navigation (the E2E sets it directly) OR via the dev-login UI.

Add a hidden/dev affordance: when `import.meta.env.VITE_DEV_AUTH === 'true'`, the
landing page shows a "Dev Login" form (email, display name, dob) calling `/auth/dev-login`.

---

## Lite mode (no Docker) — how the app runs for tests
Backend env: `USE_FAKE_REDIS=true`, `KAFKA_ENABLED=false`,
`DATABASE_URL=sqlite+aiosqlite:///./dev.db`, `DEV_AUTH_ENABLED=true`,
avatar uploads fall back to local dir `./_avatars` served at `/avatars/{name}`.
