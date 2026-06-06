import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import type { TokenResponse } from '../lib/types';

const API = import.meta.env.VITE_API_URL as string;
const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === 'true';

const FEATURES = [
  {
    t: 'Peer-to-peer',
    d: 'WebRTC connects your devices directly — messages never touch our servers.',
    icon: (
      <path
        d="M10 14a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 8M14 10a3.5 3.5 0 0 0-5 0L6.5 12.5a3.5 3.5 0 0 0 5 5L13 16"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    t: 'No message history',
    d: 'Conversations exist only in memory. Close the chat and they\'re gone — nothing is logged.',
    icon: (
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    t: 'Guest or account',
    d: 'Jump in anonymously as a guest, or sign in to keep a profile. Your call.',
    icon: (
      <path
        d="M5.5 19.5V10a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.6-2.2 1.6-2.1-1.6-2.1 1.6-2.1-1.6-1.9 1.6ZM9.5 10.5h.01M14.5 10.5h.01"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [guestLoading, setGuestLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const [devDob, setDevDob] = useState('');
  const [devError, setDevError] = useState('');
  const [guestError, setGuestError] = useState('');

  const handleGuest = async () => {
    setGuestLoading(true);
    setGuestError('');
    try {
      const resp = await api.post<TokenResponse>('/auth/guest');
      login(resp.access_token, resp.user, true);
      navigate('/app');
    } catch (err) {
      setGuestError(err instanceof Error ? err.message : 'Failed to continue as guest');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevLoading(true);
    setDevError('');
    try {
      const resp = await api.post<TokenResponse>('/auth/dev-login', {
        email: devEmail,
        display_name: devName,
        dob: devDob,
      });
      login(resp.access_token, resp.user, resp.is_guest);
      navigate('/app');
    } catch (err) {
      if (err instanceof Error && err.message.includes('403')) {
        setDevError('You must be 18 or older to register.');
      } else {
        setDevError(err instanceof Error ? err.message : 'Dev login failed');
      }
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-[100dvh] overflow-y-auto"
      style={{ background: 'radial-gradient(140% 100% at 50% -10%, var(--bg-2), var(--bg) 55%)' }}
    >
      {/* Background grid + aura */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(120% 90% at 50% 0%, #000 40%, transparent 100%)',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: '-12%',
            width: 720,
            height: 720,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft), transparent 62%)',
            filter: 'blur(14px)',
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2.5 text-ink">
          <span className="text-accent">
            <Logo size={26} live />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">Direct</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Hero */}
      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 pt-8 text-center sm:pt-14">
        <span className="mono mb-6 inline-flex items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[11.5px] font-semibold tracking-[0.1em] text-accent">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18v-6A1.5 1.5 0 0 1 6 10.5Z"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          MESSAGES NEVER STORED · PEER-TO-PEER
        </span>

        <h1
          className="font-display font-semibold tracking-tight text-ink"
          style={{ fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: 1.02, textWrap: 'balance' }}
        >
          Chat now.
          <br />
          <span className="text-accent">Forget the past.</span>
        </h1>

        <p
          className="mt-5 max-w-xl text-ink-2"
          style={{ fontSize: 'clamp(16px, 2.3vw, 20px)', lineHeight: 1.55, textWrap: 'pretty' }}
        >
          Direct connects you peer-to-peer. Messages travel straight between devices and leave
          no trace on any server. Close the chat and it’s gone for good.
        </p>

        {/* Auth */}
        <div className="mt-9 flex w-full max-w-[340px] flex-col gap-3">
          <button
            data-testid="google-btn"
            onClick={handleGoogleLogin}
            className="btn-secondary h-[52px]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <button
            data-testid="guest-btn"
            onClick={handleGuest}
            disabled={guestLoading}
            className="btn-primary h-[52px]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.5 19.5V10a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.6-2.2 1.6-2.1-1.6-2.1 1.6-2.1-1.6-1.9 1.6ZM9.5 10.5h.01M14.5 10.5h.01"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {guestLoading ? 'Loading…' : 'Continue as Guest'}
          </button>

          {guestError && <p className="text-center text-sm text-warn">{guestError}</p>}

          <p className="mono mt-1 text-[11px] tracking-wide text-ink-4">
            Guests are anonymous. You must be 18+ to use Direct.
          </p>
        </div>

        {/* Feature row */}
        <div className="mt-16 grid w-full max-w-2xl gap-3.5 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.t} className="card">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  {f.icon}
                </svg>
              </div>
              <h3 className="text-[15.5px] font-semibold tracking-tight text-ink">{f.t}</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{f.d}</p>
            </div>
          ))}
        </div>

        {/* Dev login */}
        {DEV_AUTH && (
          <div className="mt-12 w-full max-w-[340px] border-t border-dashed border-line pt-6 text-left">
            <p className="mono mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn">
              Dev Login
            </p>
            <form onSubmit={handleDevLogin} className="space-y-3">
              <input
                data-testid="dev-login-email"
                type="email"
                placeholder="Email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                required
                className="input"
              />
              <input
                data-testid="dev-login-name"
                type="text"
                placeholder="Display name (3–30 chars)"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                required
                minLength={3}
                maxLength={30}
                className="input"
              />
              <input
                data-testid="dev-login-dob"
                type="date"
                value={devDob}
                onChange={(e) => setDevDob(e.target.value)}
                required
                className="input"
              />
              {devError && <p className="text-xs text-warn">{devError}</p>}
              <button data-testid="dev-login-submit" type="submit" disabled={devLoading} className="btn-primary w-full">
                {devLoading ? 'Logging in…' : 'Dev Login'}
              </button>
            </form>
          </div>
        )}
      </main>

      <footer className="mono relative z-10 px-6 pb-8 pt-2 text-center text-[11px] tracking-[0.06em] text-ink-4">
        DIRECT · PEER-TO-PEER · NO MESSAGE HISTORY
      </footer>
    </div>
  );
};
