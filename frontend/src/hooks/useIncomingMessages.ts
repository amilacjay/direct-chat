import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { wsClient } from '../lib/websocket';
import { peerManager } from '../lib/webrtc';
import { api } from '../lib/api';
import { blobToDataUrl } from '../lib/media';
import { useChatStore } from '../store/chat';
import { useToast } from '../components/Toast';
import type { PublicUser, WsRelay } from '../lib/types';

/**
 * App-wide listener for inbound chat messages (both WebRTC P2P and server
 * relay). Mounted once in AppLayout so messages are captured and persisted even
 * when the relevant chat isn't open — and the user gets notified.
 */
export function useIncomingMessages() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const nameCache = useRef<Map<string, string>>(new Map());

  // Ask for browser notification permission once.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const getName = async (id: string): Promise<string> => {
      const cached = nameCache.current.get(id);
      if (cached) return cached;
      try {
        const u = await api.get<PublicUser>(`/users/${id}`);
        nameCache.current.set(id, u.display_name);
        return u.display_name;
      } catch {
        return 'Someone';
      }
    };

    const notify = async (fromId: string, preview: string) => {
      const { activePeer } = useChatStore.getState();
      // No need to alert about the chat the user is actively viewing.
      if (activePeer === fromId && !document.hidden) return;

      const name = await getName(fromId);
      const body = preview.length > 80 ? `${preview.slice(0, 80)}…` : preview;
      toast(`${name}: ${body}`, 'info');

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(name, { body, tag: `chat-${fromId}` });
          n.onclick = () => {
            window.focus();
            navigate(`/app/chat/${fromId}`);
            n.close();
          };
        } catch {
          // Some browsers throw if not triggered from a user gesture — ignore.
        }
      }
    };

    const ingestText = (fromId: string, text: string, relayed: boolean, ts: number) => {
      useChatStore.getState().addMessage(fromId, {
        text,
        ts,
        fromMe: false,
        relayed,
        delivered: true,
      });
      void notify(fromId, text);
    };

    const ingestPhoto = (fromId: string, token: string, relayed: boolean, ts: number) => {
      api
        .getBlob(`/photos/${token}`)
        .then(blobToDataUrl)
        .then((dataUrl) => {
          useChatStore.getState().addMessage(fromId, {
            photoUrl: dataUrl,
            ts,
            fromMe: false,
            relayed,
            delivered: true,
          });
          void notify(fromId, '📷 Photo');
        })
        .catch(() => {});
    };

    const handleRelay = (msg: WsRelay) => {
      const { text, photo_token, ts } = msg.data;
      if (photo_token) ingestPhoto(msg.from, photo_token, true, ts ?? Date.now());
      else if (text) ingestText(msg.from, text, true, ts ?? Date.now());
    };

    const handlePeerMessage = ({
      peerId,
      text,
      photo_token,
    }: {
      peerId: string;
      text?: string;
      photo_token?: string;
    }) => {
      if (photo_token) ingestPhoto(peerId, photo_token, false, Date.now());
      else if (text) ingestText(peerId, text, false, Date.now());
    };

    wsClient.on('relay', handleRelay);
    peerManager.on('message', handlePeerMessage);
    return () => {
      wsClient.off('relay', handleRelay);
      peerManager.off('message', handlePeerMessage);
    };
  }, [navigate, toast]);
}
