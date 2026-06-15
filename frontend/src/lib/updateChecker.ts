// Bulletproof client auto-update — independent of the service worker and any
// CDN caching of sw.js.
//
// How it works: index.html is tiny, served no-cache, and references the
// content-hashed entry bundle (assets/index-<hash>.js). The hash changes on
// every deploy (the build version is baked in). We periodically fetch index.html
// with a unique cache-busting query — which Cloudflare treats as a fresh URL and
// the service worker's precache won't match — and compare the deployed entry
// hash to the one this page is running. If they differ, a new build is live, so
// we drop any stale service worker / caches and reload onto it.

const POLL_MS = 60_000;
const FIRST_CHECK_MS = 10_000;
// Remember the target we last force-reloaded for, to avoid reload loops if a
// reload somehow doesn't land on the new build.
const ATTEMPT_KEY = 'app_update_target';

const ENTRY_RE = /index-[A-Za-z0-9_-]+\.js/;

// The entry-bundle hash this page actually loaded with.
function runningEntry(): string | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[src*="/assets/index-"]')
  );
  for (const s of scripts) {
    const m = (s.getAttribute('src') ?? '').match(ENTRY_RE);
    if (m) return m[0];
  }
  return null;
}

// The entry-bundle hash the server is currently serving.
async function deployedEntry(): Promise<string | null> {
  try {
    const res = await fetch(`/?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    return html.match(ENTRY_RE)?.[0] ?? null;
  } catch {
    return null;
  }
}

async function purgeAndReload(target: string): Promise<void> {
  sessionStorage.setItem(ATTEMPT_KEY, target);
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // best effort — reload regardless
  }
  window.location.reload();
}

let checking = false;

export async function checkForUpdate(): Promise<void> {
  if (checking || document.visibilityState !== 'visible') return;
  checking = true;
  try {
    const running = runningEntry();
    if (!running) return; // dev server / unknown layout — nothing to compare
    const deployed = await deployedEntry();
    if (!deployed || deployed === running) {
      sessionStorage.removeItem(ATTEMPT_KEY);
      return;
    }
    // A newer build is live. Only force one reload per target so a misbehaving
    // reload can never spin.
    if (sessionStorage.getItem(ATTEMPT_KEY) === deployed) return;
    await purgeAndReload(deployed);
  } finally {
    checking = false;
  }
}

export function startUpdateChecks(): void {
  window.setTimeout(checkForUpdate, FIRST_CHECK_MS);
  window.setInterval(checkForUpdate, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}
