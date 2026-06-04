import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { Avatar } from './Avatar';
import type { NotificationOut } from '../lib/types';

interface NavBarProps {
  notifications: NotificationOut[];
  unreadCount: number;
  onBellClick: () => void;
}

export const NavBar: React.FC<NavBarProps> = ({ notifications, unreadCount, onBellClick }) => {
  const { user, isGuest, logout } = useAuthStore();
  const navigate = useNavigate();
  const [appearOnline, setAppearOnline] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggleOnline = async () => {
    if (isGuest) return;
    const next = !appearOnline;
    setAppearOnline(next);
    // REST patch + WS presence_set
    await api.patch('/users/me', { appear_online: next }).catch(() => {
      setAppearOnline(!next); // revert on error
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
    <header className="relative bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-4 flex-shrink-0 z-20">
      {/* Brand */}
      <Link to="/app" className="font-bold text-blue-600 text-lg tracking-tight mr-2">
        Direct
      </Link>

      <div className="flex-1" />

      {/* Online toggle — registered only */}
      {!isGuest && (
        <button
          data-testid="nav-online-toggle"
          onClick={handleToggleOnline}
          title={appearOnline ? 'Appear online (click to go offline)' : 'Appear offline (click to go online)'}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
            appearOnline
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              appearOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          {appearOnline ? 'Online' : 'Offline'}
        </button>
      )}

      {/* Notifications bell */}
      <button
        data-testid="nav-bell"
        onClick={onBellClick}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            data-testid="notif-count"
            className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications dropdown */}
      {notifications.length > 0 && (
        <div className="absolute top-14 right-16 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 text-sm font-semibold text-gray-700">
            Notifications
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 text-sm border-b border-gray-50 ${
                  n.read ? 'text-gray-500' : 'text-gray-900 bg-blue-50'
                }`}
              >
                <span className="font-medium capitalize">{n.type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile menu */}
      <div className="relative" ref={menuRef}>
        <button
          data-testid="profile-link"
          onClick={() => setProfileMenuOpen((v) => !v)}
          className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Avatar src={user?.avatar_url} name={user?.display_name ?? 'U'} size="sm" />
          <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate hidden sm:block">
            {user?.display_name}
          </span>
        </button>

        {profileMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 text-sm">
            {!isGuest && (
              <>
                <Link
                  to="/app/profile"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 hover:bg-gray-50 text-gray-700"
                >
                  Profile
                </Link>
                <Link
                  to="/app/friends"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 hover:bg-gray-50 text-gray-700"
                >
                  Friends
                </Link>
                <Link
                  to="/app/settings"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-4 py-2 hover:bg-gray-50 text-gray-700"
                >
                  Settings
                </Link>
                <div className="border-t border-gray-100 my-1" />
              </>
            )}
            <button
              data-testid="logout-btn"
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
