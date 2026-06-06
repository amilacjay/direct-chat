# Direct — design port

This folder mirrors your `frontend/` source tree. Every file here is a drop-in
replacement (or a new file) that re-skins the app to the new **Direct** design —
dark + light themes, violet accent, Space Grotesk / Hanken Grotesk / JetBrains Mono,
P2P status pills, ephemeral cues, and a mobile-responsive shell.

**All logic, hooks, store calls, and `data-testid`s are unchanged** — only the
presentation layer was touched, so your tests and WebRTC/WS/photo flows keep working.

No new dependencies. Theme state uses `zustand` (already in your `package.json`).

---

## How to apply

Copy these over the matching paths in `frontend/`:

```
index.html                          → frontend/index.html        (fonts + pre-paint theme)
tailwind.config.js                  → frontend/tailwind.config.js (semantic color tokens)
src/index.css                       → frontend/src/index.css      (token system + base + .btn/.input/.card)

# new files
src/hooks/useTheme.ts               → frontend/src/hooks/useTheme.ts
src/components/ThemeToggle.tsx       → frontend/src/components/ThemeToggle.tsx
src/components/Logo.tsx              → frontend/src/components/Logo.tsx
src/components/ConnPill.tsx          → frontend/src/components/ConnPill.tsx

# replacements
src/components/Avatar.tsx
src/components/Badge.tsx
src/components/NavBar.tsx
src/pages/Landing.tsx
src/pages/AppLayout.tsx
src/pages/OnlineUsers.tsx
src/pages/Home.tsx
src/pages/Chat.tsx
src/pages/Settings.tsx
```

Then `npm run dev` as usual. That's it.

---

## How theming works

- The theme is a single attribute on `<html>`: `data-theme="dark" | "light"`.
- `index.html` sets it **before paint** (reads `localStorage['direct-theme']`, falls
  back to the OS preference) so there's no flash.
- `tailwind.config.js` maps semantic color names to CSS variables
  (`bg`, `surface`, `ink`, `accent`, `line`, `good`, `warn`, …). Those variables are
  redefined per `[data-theme]` in `index.css`, so **every `bg-surface` / `text-ink` /
  `border-line` utility re-themes automatically** — no `dark:` variants needed.
- `useTheme()` (zustand) flips the attribute and persists it. `<ThemeToggle />` is the UI;
  it lives in the NavBar and on the Settings page.
- The accent hue is one variable: `--accent-h` (default `285`, violet). Change it once in
  `index.css` to re-tint the whole app, or set it at runtime for an in-app accent picker.

---

## Semantic token cheatsheet

When you port the remaining screens, swap the old literal Tailwind classes for tokens:

| Old (light-only)            | New (themed)            |
| --------------------------- | ----------------------- |
| `bg-gray-50`                | `bg-bg`                 |
| `bg-white`                  | `bg-surface`            |
| `bg-gray-100`               | `bg-surface2`           |
| `text-gray-900`             | `text-ink`              |
| `text-gray-700` / `-800`    | `text-ink-2`            |
| `text-gray-500`             | `text-ink-3`            |
| `text-gray-400`             | `text-ink-4`            |
| `border-gray-200` / `-100`  | `border-line`           |
| `bg-blue-600` (button)      | use `.btn-primary`      |
| `text-blue-600`             | `text-accent`           |
| `bg-blue-50` / `bg-blue-100`| `bg-accent-soft`        |
| `text-red-500` (danger)     | `text-warn`             |
| `text-green-600` (online)   | `text-good`             |
| `rounded-lg` cards          | `rounded-2xl` + `.card` |
| `shadow-sm` / `shadow-xl`   | `shadow-soft` / `shadow-float` |

Component classes available globally (in `index.css`): `.btn-primary`, `.btn-secondary`,
`.btn-ghost`, `.btn-danger`, `.input`, `.card`, `.mono`.

---

## Still using the old palette (port with the table above)

These weren't in the core flow, so they're left as-is to keep this changeset focused:

- `src/pages/Profile.tsx`
- `src/pages/Friends.tsx`
- `src/components/Toast.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/LoginCallback.tsx`

They'll keep working; they'll just render in the old light palette until swapped. Happy to
port these too — just say the word.

---

## Notes

- `Chat.tsx` no longer uses `scrollIntoView` (it pinned the page during route changes).
  It now pins the message list to the bottom via a `ResizeObserver` + scrollTop, which is
  robust across font-load reflow and new messages.
- `AppLayout.tsx` is now responsive: one pane at a time on mobile (people list → tap →
  full-screen chat with a back button), two-pane on `md+`. `OnlineUsers` is `w-full md:w-72`.
- `Avatar.tsx` gained an optional `ring` prop (accent ring for the current user) and now
  renders gradient identicons; the `src`/`name`/`size` API is unchanged.
