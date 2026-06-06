import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Logo } from '../components/Logo';
import type { PublicUser, TokenResponse } from '../lib/types';

export const LoginCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const token = searchParams.get('token');
  const isNew = searchParams.get('new');
  const errorParam = searchParams.get('error');

  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState('');
  const [dobLoading, setDobLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    if (errorParam) {
      setPageError(`Login failed: ${errorParam}`);
      return;
    }

    if (!token) {
      setPageError('No token received. Please try again.');
      return;
    }

    if (isNew === '0') {
      // Already registered — fetch user and enter app
      api
        .get<PublicUser>('/users/me', token)
        .then((user) => {
          login(token, user, user.is_guest);
          navigate('/app', { replace: true });
        })
        .catch(() => {
          setPageError('Failed to load user data. Please try again.');
        });
    }
    // If isNew === '1' we show the DOB form below
  }, [token, isNew, errorParam, login, navigate]);

  const handleDobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setDobLoading(true);
    setDobError('');
    try {
      const resp = await api.post<TokenResponse>('/auth/complete-registration', { dob }, token);
      login(resp.access_token, resp.user, resp.is_guest);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDobError('You must be 18 or older to register.');
      } else {
        setDobError(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setDobLoading(false);
    }
  };

  // Shared full-screen shell with the Direct backdrop.
  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: 'radial-gradient(140% 100% at 50% -10%, var(--bg-2), var(--bg) 55%)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12%] -translate-x-1/2"
        style={{
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-soft), transparent 62%)',
          filter: 'blur(14px)',
        }}
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );

  if (pageError) {
    return (
      <Shell>
        <div className="card text-center">
          <p className="mb-4 text-warn">{pageError}</p>
          <button onClick={() => navigate('/')} className="btn-primary mx-auto text-sm">
            Back to Home
          </button>
        </div>
      </Shell>
    );
  }

  if (isNew === '1' && token) {
    return (
      <Shell>
        <div className="rounded-3xl border border-line bg-surface p-8 shadow-float">
          <div className="mb-4 text-accent">
            <Logo size={34} live />
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Almost there</h2>
          <p className="mb-6 mt-1.5 text-sm text-ink-3">
            Confirm your date of birth to finish. You must be 18 or older to use Direct.
          </p>
          <form onSubmit={handleDobSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-2">Date of Birth</label>
              <input
                data-testid="dob-input"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className="input"
              />
            </div>
            {dobError && <p className="text-sm text-warn">{dobError}</p>}
            <button data-testid="dob-submit" type="submit" disabled={dobLoading} className="btn-primary w-full">
              {dobLoading ? 'Completing registration…' : 'Complete Registration'}
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="text-sm text-ink-3">Signing you in…</p>
      </div>
    </Shell>
  );
};
