# E2E Tests (Playwright)

## Prerequisites

- Node.js 18+
- Backend running on `http://localhost:8000`
- Frontend (Vite dev server) running on `http://localhost:5173`

## First-time setup

```bash
cd e2e
npm install
npx playwright install chromium
```

## Running the tests (Lite mode — no Docker)

Start the backend with lite-mode settings (from the `backend/` directory):

```powershell
# PowerShell
$env:USE_FAKE_REDIS="true"
$env:KAFKA_ENABLED="false"
$env:DATABASE_URL="sqlite+aiosqlite:///./dev.db"
$env:DEV_AUTH_ENABLED="true"
uvicorn app.main:app --port 8000
```

Start the frontend (from the `frontend/` directory):

```powershell
npm install
npm run dev
```

Then, in the `e2e/` directory:

```bash
npm test
```

## Options

| Command | Description |
|---|---|
| `npm test` | Run all tests headless |
| `npm run test:headed` | Run with browser visible |
| `npm run test:ui` | Open Playwright UI mode |
| `npm run codegen` | Record new tests interactively |

## Notes

- The `smoke.spec.ts` test verifies the landing page loads and `data-testid="guest-btn"` is present.
- Full flow specs (registration, chat, WebRTC) are authored separately after frontend integration.
- `playwright.config.ts` intentionally has no `webServer` entry; tests assume both services are already running.
