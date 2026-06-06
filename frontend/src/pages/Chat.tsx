import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { peerManager } from '../lib/webrtc';
import { blobToDataUrl } from '../lib/media';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { Avatar } from '../components/Avatar';
import { ConnPill, type ConnState } from '../components/ConnPill';
import { GuestOnlyDisabled } from '../components/GuestOnlyDisabled';
import { GenderIcon, genderColor } from '../components/GenderIcon';
import { ProfileModal } from '../components/ProfileModal';
import type { ChatMessage } from '../store/chat';
import type { PublicUser } from '../lib/types';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

// Stable empty reference so the Zustand selector never returns a fresh array.
const NO_MESSAGES: ChatMessage[] = [];

export const Chat: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isGuest } = useAuthStore();

  const messages = useChatStore((s) => (userId ? s.conversations[userId] : undefined)) ?? NO_MESSAGES;
  const addMessage = useChatStore((s) => s.addMessage);
  const setActivePeer = useChatStore((s) => s.setActivePeer);

  const [peer, setPeer] = useState<PublicUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [inputText, setInputText] = useState('');
  const [webrtcOpen, setWebrtcOpen] = useState(false);
  const [webrtcFailed, setWebrtcFailed] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const offerStarted = useRef(false);

  // --- Robust auto-scroll to bottom (no scrollIntoView): pin on content growth. ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const jump = () => {
      el.scrollTop = el.scrollHeight;
    };
    jump();
    const ro = new ResizeObserver(jump);
    if (innerRef.current) ro.observe(innerRef.current);
    let n = 0;
    const iv = window.setInterval(() => {
      jump();
      if (++n > 15) window.clearInterval(iv);
    }, 50);
    if (document.fonts?.ready) document.fonts.ready.then(jump).catch(() => {});
    return () => {
      ro.disconnect();
      window.clearInterval(iv);
    };
  }, [userId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Fetch peer user info
  useEffect(() => {
    if (!userId) return;
    api.get<PublicUser>(`/users/${userId}`).then(setPeer).catch(() => {});
  }, [userId]);

  // Mark this conversation active while on screen.
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

  // WebRTC connection status
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

      const previewUrl = await blobToDataUrl(file);
      addMessage(userId, { photoUrl: previewUrl, ts: Date.now(), fromMe: true, relayed: !webrtcOpen, delivered: true });
    } catch {
      setPhotoError('Failed to upload photo');
    }

    e.target.value = '';
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!userId) return null;

  const connState: ConnState = webrtcOpen ? 'p2p' : webrtcFailed ? 'relay' : 'connecting';

  return (
    <>
    <div className="flex h-full flex-col bg-bg">
      {/* Header */}
      <header
        className="z-10 flex flex-shrink-0 items-center gap-3 border-b border-line px-4 py-3"
        style={{ background: 'color-mix(in oklch, var(--bg) 80%, transparent)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/app')}
          aria-label="Back"
          className="-ml-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl text-ink-3 hover:bg-surface2 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {peer ? (
          <button
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition-colors hover:bg-surface2"
            onClick={() => !peer.is_guest && setShowProfile(true)}
            title={peer.is_guest ? undefined : 'View profile'}
          >
            <div className="relative flex-shrink-0">
              <Avatar src={peer.avatar_url} name={peer.display_name} size="md" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-bg" style={{ background: 'var(--good)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15.5px] font-semibold tracking-tight text-ink">{peer.display_name}</p>
              <div className="flex items-center gap-1 text-xs text-good">
                {peer.gender && (
                  <span className={`flex items-center ${genderColor[peer.gender] ?? 'text-ink-3'}`}>
                    <GenderIcon gender={peer.gender} className="h-3 w-3" />
                  </span>
                )}
                {peer.age && <span className="text-ink-3">{peer.age} ·</span>}
                <span>{webrtcOpen ? 'online' : webrtcFailed ? 'online' : 'connecting…'}</span>
              </div>
            </div>
          </button>
        ) : (
          <div className="h-4 w-32 animate-pulse rounded bg-surface2" />
        )}

        <ConnPill state={connState} />
      </header>

      {/* Messages */}
      <div ref={scrollRef} data-testid="chat-messages" className="flex-1 overflow-y-auto px-[clamp(14px,4vw,40px)] py-4">
        <div ref={innerRef} className="flex min-h-full flex-col justify-end gap-2">
          {/* Ephemeral banner */}
          <div className="mono mx-auto mb-3 inline-flex items-center gap-1.5 self-center rounded-full border border-dashed border-lineHi bg-surface px-3 py-1.5 text-[10.5px] tracking-wide text-ink-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 2.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Nothing here is saved. Leave and it’s gone.
          </div>

          {messages.length === 0 && (
            <div className="mt-8 text-center text-sm text-ink-4">
              <p>Say hello!</p>
              <p className="mt-1 text-xs">{webrtcOpen ? 'Using P2P connection' : 'Messages will be relayed via server'}</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const next = messages[i + 1];
            const showTail = !next || next.fromMe !== msg.fromMe;
            return (
              <div
                key={msg.id}
                data-testid="message"
                className={`flex animate-msgIn ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[min(76%,460px)] break-words text-[15px] leading-snug shadow-soft"
                  style={{
                    padding: msg.photoUrl ? 5 : '10px 14px',
                    borderRadius: 22,
                    borderBottomRightRadius: msg.fromMe && showTail ? 7 : 22,
                    borderBottomLeftRadius: !msg.fromMe && showTail ? 7 : 22,
                    background: msg.fromMe
                      ? 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))'
                      : 'var(--bubble-in)',
                    color: msg.fromMe ? 'var(--on-accent)' : 'var(--text)',
                    border: msg.fromMe ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {msg.photoUrl ? (
                    <img src={msg.photoUrl} alt="Shared" className="max-h-64 max-w-full rounded-2xl object-cover" />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                  <div className={`mt-1 flex items-center justify-end gap-1.5 ${msg.photoUrl ? 'pr-1' : ''}`}>
                    {msg.relayed && (
                      <span
                        className="mono rounded px-1 text-[9px] uppercase tracking-wide"
                        style={{ background: 'color-mix(in oklch, currentColor 16%, transparent)', opacity: 0.85 }}
                      >
                        relayed
                      </span>
                    )}
                    <span className="mono text-[9.5px]" style={{ opacity: msg.fromMe ? 0.8 : 0.55 }}>
                      {formatTime(msg.ts)}
                    </span>
                    {msg.fromMe && msg.delivered && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
                        <path d="M2 12.5 6.5 17l8-10M11 15l1 1 7.5-9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-3.5 pt-2.5" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        {photoError && <p className="mb-2 text-xs text-warn">{photoError}</p>}
        <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-1.5 shadow-soft">
          {isGuest ? (
            <GuestOnlyDisabled tooltip="Sign in to send photos" tooltipAlign="left">
              <button
                data-testid="photo-btn"
                className="grid h-11 w-11 place-items-center rounded-2xl text-ink-3 transition-colors hover:bg-surface2"
              >
                <PhotoIcon />
              </button>
            </GuestOnlyDisabled>
          ) : (
            <>
              <button
                data-testid="photo-btn"
                onClick={handlePhotoClick}
                title="Send photo"
                className="grid h-11 w-11 place-items-center rounded-2xl text-ink-3 transition-colors hover:bg-surface2"
              >
                <PhotoIcon />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </>
          )}

          <input
            data-testid="chat-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message — disappears when you leave"
            className="flex-1 border-none bg-transparent px-1 py-2.5 text-base text-ink outline-none placeholder:text-ink-4"
          />

          <button
            data-testid="chat-send"
            onClick={sendMessage}
            disabled={!inputText.trim()}
            aria-label="Send"
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl transition-all"
            style={{
              background: inputText.trim() ? 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))' : 'var(--surface-2)',
              color: inputText.trim() ? 'var(--on-accent)' : 'var(--text-4)',
              boxShadow: inputText.trim() ? '0 4px 16px var(--accent-soft)' : 'none',
              transform: inputText.trim() ? 'scale(1)' : 'scale(.96)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 11L17 6.2a.6.6 0 0 1 .82.78l-4.5 11.4a.6.6 0 0 1-1.1.04L10.5 13.5 7 11Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    {showProfile && userId && (
      <ProfileModal userId={userId} onClose={() => setShowProfile(false)} />
    )}
    </>
  );
};

const PhotoIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm0 9 4-3.6a1.5 1.5 0 0 1 2 0l2.5 2.3m0 0 2-1.7a1.5 1.5 0 0 1 1.9 0L20 14.2M15.5 8.5h.01"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
