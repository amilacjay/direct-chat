import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { wsClient } from '../lib/websocket';
import { peerManager } from '../lib/webrtc';
import { api } from '../lib/api';
import { NavBar } from '../components/NavBar';
import { OnlineUsers } from './OnlineUsers';
import { useIncomingMessages } from '../hooks/useIncomingMessages';
import { useAccentColor } from '../hooks/useAccentColor';
import type { NotificationOut, WsNotification, WsSignal } from '../lib/types';

export const AppLayout: React.FC = () => {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const wsConnected = useRef(false);

  // On mobile show ONE pane at a time.
  // Sidebar (people list) only when at the root /app home. Any sub-route
  // (chat, profile, friends, settings) gets the full-width main pane.
  const onHome = location.pathname === '/app' || location.pathname === '/app/';

  useIncomingMessages();
  useAccentColor();

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token || wsConnected.current) return;
    wsConnected.current = true;
    wsClient.connect(token);

    return () => {
      wsConnected.current = false;
      wsClient.disconnect();
      peerManager.closeAll();
    };
  }, [token]);

  useEffect(() => {
    const handler = (msg: WsSignal) => {
      peerManager.handleSignal(msg.from, msg.data).catch(() => {});
    };
    wsClient.on('signal', handler);
    return () => wsClient.off('signal', handler);
  }, []);

  useEffect(() => {
    if (user && !user.is_guest) {
      api.get<NotificationOut[]>('/notifications').then(setNotifications).catch(() => {});
    }
  }, [user]);

  const handleNotification = useCallback((msg: WsNotification) => {
    setNotifications((prev) => [msg.data, ...prev]);
  }, []);

  useEffect(() => {
    wsClient.on('notification', handleNotification);
    return () => wsClient.off('notification', handleNotification);
  }, [handleNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleBellClick = () => {
    setShowNotifs((v) => !v);
    if (!showNotifs && unreadCount > 0) {
      api
        .post('/notifications/read-all')
        .then(() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        })
        .catch(() => {});
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg text-ink">
      <NavBar
        notifications={notifications}
        unreadCount={unreadCount}
        notifMenuOpen={showNotifs}
        onBellClick={handleBellClick}
        onCloseNotifs={() => setShowNotifs(false)}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* People list — full width on mobile only on home; hidden on sub-routes */}
        <div className={`${onHome ? 'flex' : 'hidden md:flex'} w-full md:w-auto`}>
          <OnlineUsers collapsed={!sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
        </div>
        {/* Main pane — hidden on mobile when at home, visible on any sub-route */}
        <main className={`${onHome ? 'hidden md:block' : 'block'} flex-1 overflow-hidden`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
