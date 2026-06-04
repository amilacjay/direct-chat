import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/Toast';
import type { NotificationOut } from '../lib/types';

interface BlockedUser {
  id: string;
  display_name: string;
}

export const Settings: React.FC = () => {
  const { isGuest } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [appearOnline, setAppearOnline] = useState(true);
  const [savingOnline, setSavingOnline] = useState(false);
  // Block list is local — API endpoint for listing blocks is not specified in contract
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
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Presence */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">Presence</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 font-medium">Appear online</p>
            <p className="text-xs text-gray-400">
              {appearOnline
                ? 'Others can see you in the online list'
                : 'You are invisible to other users'}
            </p>
          </div>
          <button
            data-testid="nav-online-toggle"
            onClick={handleToggleOnline}
            disabled={savingOnline}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              appearOnline ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={appearOnline}
          >
            <span
              className={`inline-block w-4 h-4 mt-1 ml-1 rounded-full bg-white shadow transform transition-transform ${
                appearOnline ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Notifications</h2>
          {notifications.length > 0 && (
            <button
              data-testid="clear-notifications"
              onClick={handleClearNotifications}
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No notifications</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-center justify-between gap-3 p-2 rounded-lg text-sm ${
                  n.read ? 'bg-gray-50' : 'bg-blue-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-gray-800 font-medium truncate">{formatNotifType(n.type)}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveNotification(n.id)}
                  title="Remove"
                  aria-label="Remove notification"
                  className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Block list */}
      <section className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Blocked Users</h2>

        <form onSubmit={handleBlock} className="flex gap-2 mb-4">
          <input
            type="text"
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            placeholder="User ID to block"
            className="input flex-1 text-sm"
          />
          <button type="submit" className="btn-danger text-sm">
            Block
          </button>
        </form>

        {blockedUsers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No blocked users</p>
        ) : (
          <div className="space-y-2">
            {blockedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
              >
                <span className="text-gray-700">{u.display_name}</span>
                <button
                  onClick={async () => {
                    try {
                      await api.delete(`/friends/block/${u.id}`);
                      toast('User unblocked', 'success');
                    } catch {
                      toast('Failed to unblock', 'error');
                    }
                  }}
                  className="text-red-500 text-xs hover:underline"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
