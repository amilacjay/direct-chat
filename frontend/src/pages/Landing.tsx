import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import type { TokenResponse } from '../lib/types';

const API = import.meta.env.VITE_API_URL as string;
const DEV_AUTH = import.meta.env.VITE_DEV_AUTH === 'true';

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Direct</h1>
          <p className="text-gray-500 text-sm">Peer-to-peer private chat</p>
        </div>

        {/* Auth Buttons */}
        <div className="space-y-3 mb-6">
          <button
            data-testid="google-btn"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
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
            Sign in with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="bg-white px-2">or</span>
            </div>
          </div>

          <button
            data-testid="guest-btn"
            onClick={handleGuest}
            disabled={guestLoading}
            className="w-full py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors disabled:opacity-50"
          >
            {guestLoading ? 'Loading...' : 'Continue as Guest'}
          </button>

          {guestError && (
            <p className="text-red-500 text-sm text-center">{guestError}</p>
          )}

          <p className="text-xs text-gray-400 text-center">
            You must be 18 or older to create an account.
          </p>
        </div>

        {/* Dev Login Form */}
        {DEV_AUTH && (
          <div className="mt-6 pt-6 border-t border-dashed border-gray-200">
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3">
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
                className="input text-sm"
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
                className="input text-sm"
              />
              <input
                data-testid="dev-login-dob"
                type="date"
                placeholder="Date of birth"
                value={devDob}
                onChange={(e) => setDevDob(e.target.value)}
                required
                className="input text-sm"
              />
              {devError && (
                <p className="text-red-500 text-xs">{devError}</p>
              )}
              <button
                data-testid="dev-login-submit"
                type="submit"
                disabled={devLoading}
                className="w-full btn-primary text-sm py-2"
              >
                {devLoading ? 'Logging in...' : 'Dev Login'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
