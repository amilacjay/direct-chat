import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { peerManager } from '../lib/webrtc';
import { blobToDataUrl } from '../lib/media';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { Avatar } from '../components/Avatar';
import { GuestOnlyDisabled } from '../components/GuestOnlyDisabled';
import type { ChatMessage } from '../store/chat';
import type { PublicUser } from '../lib/types';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

// Stable empty reference so the Zustand selector never returns a fresh array
// for an empty conversation (which would trigger an infinite render loop).
const NO_MESSAGES: ChatMessage[] = [];

export const Chat: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { isGuest } = useAuthStore();

  // Messages are kept in the persisted global store so they survive navigating
  // between chats and page reloads. Inbound messages are ingested globally
  // (see useIncomingMessages); this component only renders + sends.
  const messages = useChatStore((s) => (userId ? s.conversations[userId] : undefined)) ?? NO_MESSAGES;
  const addMessage = useChatStore((s) => s.addMessage);
  const setActivePeer = useChatStore((s) => s.setActivePeer);

  const [peer, setPeer] = useState<PublicUser | null>(null);
  const [inputText, setInputText] = useState('');
  const [webrtcOpen, setWebrtcOpen] = useState(false);
  const [webrtcFailed, setWebrtcFailed] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const offerStarted = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch peer user info
  useEffect(() => {
    if (!userId) return;
    api.get<PublicUser>(`/users/${userId}`).then(setPeer).catch(() => {});
  }, [userId]);

  // Mark this conversation active (suppresses its notifications + clears unread)
  // while it's on screen.
  useEffect(() => {
    if (!userId) return;
    setActivePeer(userId);
    return () => setActivePeer(null);
  }, [userId, setActivePeer]);

  // Start WebRTC offer when chat opens
  useEffect(() => {
    if (!userId || offerStarted.current) return;
    offerStarted.current = true;

    peerManager.createOffer(userId).catch(() => {
      setWebrtcFailed(true);
    });

    return () => {
      peerManager.closePeer(userId);
      offerStarted.current = false;
    };
  }, [userId]);

  // WebRTC connection status (message ingestion is handled globally).
  useEffect(() => {
    if (!userId) return;

    const handleOpen = ({ peerId }: { peerId: string }) => {
      if (peerId === userId) {
        setWebrtcOpen(true);
        setWebrtcFailed(false);
      }
    };

    const handleFailed = ({ peerId }: { peerId: string }) => {
      if (peerId === userId) {
        setWebrtcFailed(true);
        setWebrtcOpen(false);
      }
    };

    peerManager.on('open', handleOpen);
    peerManager.on('failed', handleFailed);

    return () => {
      peerManager.off('open', handleOpen);
      peerManager.off('failed', handleFailed);
    };
  }, [userId]);

  const sendMessage = () => {
    const text = inputText.trim();
    if (!text || !userId) return;

    const ts = Date.now();
    let relayed = false;

    if (webrtcOpen && !webrtcFailed) {
      const sent = peerManager.sendText(userId, text);
      if (!sent) {
        relayed = true;
        wsClient.send({ type: 'relay', to: userId, data: { text, ts } });
      }
    } else {
      relayed = true;
      wsClient.send({ type: 'relay', to: userId, data: { text, ts } });
    }

    addMessage(userId, { text, ts, fromMe: true, relayed, delivered: true });
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePhotoClick = () => {
    if (isGuest) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setPhotoError('');

    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError('File too large (max 5 MB)');
      e.target.value = '';
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, GIF, WebP images are allowed');
      e.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('to', userId);
      const { token: photoToken } = await api.postForm<{ token: string; expires_at: string }>(
        '/photos/upload',
        formData
      );

      const photoData = { photo_token: photoToken, ts: Date.now() };

      if (webrtcOpen && !webrtcFailed) {
        peerManager.sendData(userId, photoData);
      } else {
        wsClient.send({ type: 'relay', to: userId, data: photoData });
      }

      // Show preview to sender (data URL so it persists across navigation/reload)
      const previewUrl = await blobToDataUrl(file);
      addMessage(userId, { photoUrl: previewUrl, ts: Date.now(), fromMe: true, relayed: !webrtcOpen, delivered: true });
    } catch {
      setPhotoError('Failed to upload photo');
    }

    e.target.value = '';
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!userId) return null;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {peer ? (
          <>
            <div className="relative">
              <Avatar src={peer.avatar_url} name={peer.display_name} size="sm" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">{peer.display_name}</p>
              <p className="text-xs text-gray-400">
                {webrtcOpen ? (
                  <span className="text-green-600">P2P connected</span>
                ) : webrtcFailed ? (
                  <span className="text-orange-500">Relayed via server</span>
                ) : (
                  <span className="text-gray-400">Connecting…</span>
                )}
              </p>
            </div>
          </>
        ) : (
          <div className="w-32 h-4 bg-gray-200 animate-pulse rounded" />
        )}
      </div>

      {/* Messages */}
      <div
        data-testid="chat-messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-400 mt-8">
            <p>Say hello!</p>
            <p className="text-xs mt-1">
              {webrtcOpen ? 'Using P2P connection' : 'Messages will be relayed via server'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid="message"
            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md rounded-2xl px-3 py-2 ${
                msg.fromMe
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
              }`}
            >
              {msg.photoUrl ? (
                <img
                  src={msg.photoUrl}
                  alt="Shared photo"
                  className="max-w-full rounded-lg max-h-64 object-cover"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
              )}
              <div
                className={`flex items-center gap-1 mt-1 text-xs ${
                  msg.fromMe ? 'text-blue-200 justify-end' : 'text-gray-400'
                }`}
              >
                <span>{formatTime(msg.ts)}</span>
                {msg.relayed && (
                  <span className={`text-xs px-1 rounded ${msg.fromMe ? 'bg-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    relayed
                  </span>
                )}
                {msg.fromMe && msg.delivered && <span>✓</span>}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        {photoError && (
          <p className="text-red-500 text-xs mb-2">{photoError}</p>
        )}
        <div className="flex items-center gap-2">
          {/* Photo button */}
          {isGuest ? (
            <GuestOnlyDisabled tooltip="Sign in to send photos">
              <button
                data-testid="photo-btn"
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </GuestOnlyDisabled>
          ) : (
            <>
              <button
                data-testid="photo-btn"
                onClick={handlePhotoClick}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                title="Send photo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}

          <input
            data-testid="chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1 input text-sm"
          />

          <button
            data-testid="chat-send"
            onClick={sendMessage}
            disabled={!inputText.trim()}
            className="btn-primary p-2 disabled:opacity-40"
            aria-label="Send"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
