import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/Toast';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggle } from '../components/ThemeToggle';
import { ConnPill } from '../components/ConnPill';
import type { NotificationOut } from '../lib/types';

interface BlockedUser {
  id: string;
  display_name: string;
}

export const Settings: React.FC = () => {
  const { isGuest } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [appearOnline, setAppearOnline] = useState(true);
  const [savingOnline, setSavingOnline] = useState(false);
  const [blockedUsers] = useState<BlockedUser[]>([]);
  const [blockInput, setBlockInput] = useState('');
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);

  useEffect(() => {
    if (isGuest) {
      navigate('/app', { replace: true });
    }
  }, [isGuest, navigate]);

  useEffect(() => {
    if (isGuest) return;
    api.get<NotificationOut[]>('/notifications').then(setNotifications).catch(() => {});
  }, [isGuest]);

  const handleRemoveNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      toast('Failed to remove notification', 'error');
    }
  };

  const handleClearNotifications = async () => {
    try {
      await api.delete('/notifications');
      setNotifications([]);
      toast('Notifications cleared', 'success');
    } catch {
      toast('Failed to clear notifications', 'error');
    }
  };

  const formatNotifType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const handleToggleOnline = async () => {
    const next = !appearOnline;
    setSavingOnline(true);
    try {
      await api.patch('/users/me', { appear_online: next });
      setAppearOnline(next);
      toast(`You are now ${next ? 'visible' : 'hidden'} to others`, 'success');
    } catch {
      toast('Failed to update visibility', 'error');
    } finally {
      setSavingOnline(false);
    }
  };

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = blockInput.trim();
    if (!uid) return;
    try {
      await api.post(`/friends/block/${uid}`);
      toast(`Blocked user ${uid}`, 'success');
      setBlockInput('');
    } catch {
      toast('Failed to block user', 'error');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {/* Mobile header */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-line px-2 py-2 md:hidden">
        <button
          onClick={() => navigate('/app')}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-surface2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight text-ink">Settings</h1>
      </div>
    <div className="flex-1 overflow-y-auto">
    <div className="mx-auto max-w-lg p-6">
      <h1 className="font-display mb-6 hidden text-2xl font-semibold tracking-tight text-ink md:block">Settings</h1>

      {/* Appearance */}
      <section className="card mb-4">
        <h2 className="mb-3 font-semibold text-ink-2">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Theme</p>
            <p className="text-xs text-ink-3">{theme === 'dark' ? 'Dark — easy on the eyes' : 'Light — clean & bright'}</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {/* Presence */}
      <section className="card mb-4">
        <h2 className="mb-3 font-semibold text-ink-2">Presence</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Appear online</p>
            <p className="text-xs text-ink-3">
              {appearOnline ? 'Others can see you in the online list' : 'You are invisible to other users'}
            </p>
          </div>
          <button
            data-testid="nav-online-toggle"
            onClick={handleToggleOnline}
            disabled={savingOnline}
            className="relative inline-flex h-7 w-12 flex-shrink-0 rounded-full p-[3px] transition-colors focus:outline-none disabled:opacity-50"
            style={{ background: appearOnline ? 'var(--accent)' : 'var(--surface-hi)' }}
            role="switch"
            aria-checked={appearOnline}
          >
            <span
              className="inline-block h-[22px] w-[22px] rounded-full bg-white shadow transition-transform"
              style={{ transform: appearOnline ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </section>

      {/* Privacy */}
      <section className="mb-4 rounded-2xl border border-accent-line bg-accent-soft p-4">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-accent">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 18 19.5H6A1.5 1.5 0 0 1 4.5 18v-6A1.5 1.5 0 0 1 6 10.5Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Nothing is stored
          <span className="ml-auto"><ConnPill state="p2p" compact /></span>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          Direct keeps no message history, no profiles, and no metadata on its servers. Your
          conversations exist only on the devices in the chat.
        </p>
      </section>

      {/* Notifications */}
      <section className="card mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-2">Notifications</h2>
          {notifications.length > 0 && (
            <button
              data-testid="clear-notifications"
              onClick={handleClearNotifications}
              className="text-xs text-warn hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-4">No notifications</p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-center justify-between gap-3 rounded-xl p-2 text-sm ${
                  n.read ? 'bg-surface2' : 'bg-accent-soft'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{formatNotifType(n.type)}</p>
                  <p className="text-xs text-ink-4">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => handleRemoveNotification(n.id)}
                  title="Remove"
                  aria-label="Remove notification"
                  className="flex-shrink-0 rounded p-1 text-ink-4 transition-colors hover:bg-surface2 hover:text-warn"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Block list */}
      <section className="card">
        <h2 className="mb-3 font-semibold text-ink-2">Blocked Users</h2>

        <form onSubmit={handleBlock} className="mb-4 flex gap-2">
          <input
            type="text"
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            placeholder="User ID to block"
            className="input flex-1"
          />
          <button type="submit" className="btn-danger">
            Block
          </button>
        </form>

        {blockedUsers.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-4">No blocked users</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-surface2 p-2 text-sm">
                <span className="text-ink-2">{u.display_name}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.delete(`/friends/block/${u.id}`);
                      toast('User unblocked', 'success');
                    } catch {
                      toast('Failed to unblock', 'error');
                    }
                  }}
                  className="text-xs text-warn hover:underline"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </div>
    </div>
  );
};
