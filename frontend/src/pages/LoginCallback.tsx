import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth';
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
      const resp = await api.post<TokenResponse>(
        '/auth/complete-registration',
        { dob },
        token
      );
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

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-sm w-full text-center">
          <p className="text-red-500 mb-4">{pageError}</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (isNew === '1' && token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Almost there!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Please confirm your date of birth to complete registration.
            You must be 18 or older.
          </p>
          <form onSubmit={handleDobSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </label>
              <input
                data-testid="dob-input"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
                className="input"
              />
            </div>
            {dobError && <p className="text-red-500 text-sm">{dobError}</p>}
            <button
              data-testid="dob-submit"
              type="submit"
              disabled={dobLoading}
              className="w-full btn-primary"
            >
              {dobLoading ? 'Completing registration...' : 'Complete Registration'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Signing you in…</p>
      </div>
    </div>
  );
};
