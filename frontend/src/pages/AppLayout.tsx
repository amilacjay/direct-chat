import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { wsClient } from '../lib/websocket';
import { peerManager } from '../lib/webrtc';
import { api } from '../lib/api';
import { NavBar } from '../components/NavBar';
import { OnlineUsers } from './OnlineUsers';
import { useIncomingMessages } from '../hooks/useIncomingMessages';
import type { NotificationOut, WsNotification, WsSignal } from '../lib/types';

export const AppLayout: React.FC = () => {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const wsConnected = useRef(false);

  // Capture + persist inbound chat messages and surface notifications globally,
  // independent of which chat (if any) is open.
  useIncomingMessages();

  // Guard
  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  // Connect WS
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

  // Handle incoming signals for WebRTC
  useEffect(() => {
    const handler = (msg: WsSignal) => {
      peerManager.handleSignal(msg.from, msg.data).catch(() => {});
    };
    wsClient.on('signal', handler);
    return () => wsClient.off('signal', handler);
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (user && !user.is_guest) {
      api.get<NotificationOut[]>('/notifications').then(setNotifications).catch(() => {});
    }
  }, [user]);

  // Live notifications via WS
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
      api.post('/notifications/read-all').then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }).catch(() => {});
    }
  };

  if (!token) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar
        notifications={showNotifs ? notifications : []}
        unreadCount={unreadCount}
        onBellClick={handleBellClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <OnlineUsers />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
