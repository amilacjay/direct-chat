import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { Avatar } from './Avatar';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import type { NotificationOut } from '../lib/types';

interface NavBarProps {
  notifications: NotificationOut[];
  unreadCount: number;
  notifMenuOpen: boolean;
  onBellClick: () => void;
  onCloseNotifs: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({
  notifications,
  unreadCount,
  notifMenuOpen,
  onBellClick,
  onCloseNotifs,
}) => {
  const { user, isGuest, logout } = useAuthStore();
  const navigate = useNavigate();
  const [appearOnline, setAppearOnline] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        onCloseNotifs();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCloseNotifs]);

  const handleToggleOnline = async () => {
    if (isGuest) return;
    const next = !appearOnline;
    setAppearOnline(next);
    await api.patch('/users/me', { appear_online: next }).catch(() => {
      setAppearOnline(!next);
    });
    wsClient.send({ type: 'presence_set', data: { appear_online: next } });
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    logout();
    useChatStore.getState().clearAll();
    wsClient.disconnect();
    navigate('/', { replace: true });
  };

  return (
    <header className="relative z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-line bg-bg px-4">
      {/* Brand */}
      <Link to="/app" className="mr-1 flex items-center gap-2 text-ink">
        <span className="text-accent">
          <Logo size={24} live />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">Direct</span>
      </Link>

      <div className="flex-1" />

      <ThemeToggle />

      {/* Online toggle — registered only */}
      {!isGuest && (
        <button
          data-testid="nav-online-toggle"
          onClick={handleToggleOnline}
          title={appearOnline ? 'Appear online (click to go offline)' : 'Appear offline (click to go online)'}
          className={`mono hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition-colors sm:flex ${
            appearOnline ? 'text-good' : 'text-ink-3'
          }`}
          style={{ background: 'color-mix(in oklch, currentColor 12%, transparent)' }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: 'currentColor', animation: appearOnline ? 'pulseDot 1.6s ease-in-out infinite' : 'none' }}
          />
          {appearOnline ? 'ONLINE' : 'OFFLINE'}
        </button>
      )}

      {/* Notifications */}
      <div ref={notifRef}>
        <button
          data-testid="nav-bell"
          onClick={onBellClick}
          className="relative grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-surface2"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path
              d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5H4.5s2-1.5 2-6.5ZM9.5 19a2.5 2.5 0 0 0 5 0"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unreadCount > 0 && (
            <span
              data-testid="notif-count"
              className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-accent-ink"
              style={{ background: 'var(--accent)' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifMenuOpen && (
          <div className="absolute right-14 top-14 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
            <div className="border-b border-line p-3 text-sm font-semibold text-ink-2">Notifications</div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-4">No notifications</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-line px-4 py-3 text-sm ${
                      n.read ? 'text-ink-3' : 'bg-accent-soft text-ink'
                    }`}
                  >
                    <span className="font-medium capitalize">{n.type.replace(/_/g, ' ')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          data-testid="profile-link"
          onClick={() => setProfileMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-surface2"
        >
          <Avatar src={user?.avatar_url} name={user?.display_name ?? 'U'} size="sm" />
          <span className="hidden max-w-[100px] truncate text-sm font-medium text-ink-2 sm:block">
            {user?.display_name}
          </span>
        </button>

        {profileMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-2xl border border-line bg-surface py-1 text-sm shadow-float">
            {!isGuest && (
              <>
                <Link
                  to="/app/profile"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 text-ink-2 hover:bg-surface2"
                >
                  Profile
                </Link>
                <Link
                  to="/app/friends"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 text-ink-2 hover:bg-surface2"
                >
                  Friends
                </Link>
                <Link
                  to="/app/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 text-ink-2 hover:bg-surface2"
                >
                  Settings
                </Link>
                <div className="my-1 border-t border-line" />
              </>
            )}
            <button
              data-testid="logout-btn"
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-warn hover:bg-surface2"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
