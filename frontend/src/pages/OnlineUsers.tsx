import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { Avatar } from '../components/Avatar';
import { GenderIcon, genderColor } from '../components/GenderIcon';
import { ProfileModal } from '../components/ProfileModal';
import type { Friend, OnlineUser } from '../lib/types';
import type { WsPresenceSnapshot, WsPresenceJoin, WsPresenceLeave } from '../lib/types';

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const OnlineUsers: React.FC<Props> = ({ collapsed = false, onToggle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: me, isGuest } = useAuthStore();

  const activeChatId = location.pathname.match(/^\/app\/chat\/(.+)/)?.[1] ?? null;
  const unread = useChatStore((s) => s.unread);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    api.get<OnlineUser[]>('/users/online').then(setOnlineUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (isGuest) return;
    api.get<Friend[]>('/friends').then(setFriends).catch(() => {});
  }, [isGuest]);

  const handlePresence = useCallback(
    (msg: WsPresenceSnapshot | WsPresenceJoin | WsPresenceLeave) => {
      if (msg.data.event === 'snapshot') {
        setOnlineUsers(msg.data.users);
      } else if (msg.data.event === 'join') {
        const joined = msg.data.user;
        setOnlineUsers((prev) => (prev.find((u) => u.id === joined.id) ? prev : [...prev, joined]));
      } else if (msg.data.event === 'leave') {
        const leftId = msg.data.id;
        setOnlineUsers((prev) => prev.filter((u) => u.id !== leftId));
      }
    },
    []
  );

  useEffect(() => {
    wsClient.on('presence', handlePresence);
    return () => wsClient.off('presence', handlePresence);
  }, [handlePresence]);

  const handleAddFriend = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (isGuest) return;
    setAddingFriend(userId);
    try {
      await api.post(`/friends/request/${userId}`);
    } catch {
      // ignore
    } finally {
      setAddingFriend(null);
    }
  };

  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  const friendIds = new Set(friends.map((f) => f.user.id));

  const friendRows = [...friends].sort(
    (a, b) => Number(onlineIds.has(b.user.id)) - Number(onlineIds.has(a.user.id))
  );
  const otherOnline = onlineUsers.filter((u) => u.id !== me?.id && !friendIds.has(u.id));

  const UnreadBadge: React.FC<{ id: string }> = ({ id }) =>
    (unread[id] ?? 0) > 0 ? (
      <span
        data-testid="unread-badge"
        className="flex h-[18px] min-w-[18px] flex-shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-accent-ink"
        style={{ background: 'var(--accent)' }}
      >
        {unread[id] > 9 ? '9+' : unread[id]}
      </span>
    ) : null;

  const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="mono px-4 pb-2 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
      {children}
    </h2>
  );

  const UserMeta: React.FC<{ gender?: string | null; age?: number | null; status: string }> = ({ gender, age, status }) => {
    const parts: React.ReactNode[] = [];
    if (gender) {
      parts.push(
        <span key="g" className={`flex items-center gap-0.5 ${genderColor[gender] ?? 'text-ink-3'}`}>
          <GenderIcon gender={gender} className="h-3 w-3" />
        </span>
      );
    }
    if (age) parts.push(<span key="a">{age}</span>);
    if (parts.length) parts.push(<span key="sep" className="text-ink-4">·</span>);
    parts.push(<span key="s">{status}</span>);
    return <p className="flex items-center gap-1 text-xs text-ink-3">{parts}</p>;
  };

  const ChevronButton = () => (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface2 hover:text-ink"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
        <path
          d={collapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  if (collapsed) {
    return (
      <div className="hidden md:flex w-12 flex-shrink-0 flex-col items-center border-r border-line bg-bg pt-3">
        <ChevronButton />
      </div>
    );
  }

  return (
    <div
      data-testid="online-users"
      className="flex w-full flex-shrink-0 flex-col border-r border-line bg-bg md:w-72"
    >
      <div className="hidden md:flex items-center justify-end px-3 pt-2">
        <ChevronButton />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Friends */}
        {!isGuest && (
          <>
            <SectionLabel>Friends — {friends.length}</SectionLabel>
            {friends.length === 0 && (
              <p className="px-4 pb-2 text-center text-sm text-ink-4">No friends yet</p>
            )}
            {friendRows.map((f) => {
              const online = onlineIds.has(f.user.id);
              return (
                <button
                  key={f.friendship_id}
                  data-testid="user-item"
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface2 ${activeChatId === f.user.id ? 'bg-surface2 ring-1 ring-inset ring-line' : ''}`}
                  onClick={() => navigate(`/app/chat/${f.user.id}`)}
                >
                  <div
                    className="relative flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); setProfileUserId(f.user.id); }}
                    title="View profile"
                  >
                    <Avatar src={f.user.avatar_url} name={f.user.display_name} size="md" />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-bg"
                      style={{ background: online ? 'var(--good)' : 'var(--text-4)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-ink">{f.user.display_name}</p>
                    <UserMeta gender={f.user.gender} age={f.user.age} status={online ? 'Online' : 'Offline'} />
                  </div>
                  <UnreadBadge id={f.user.id} />
                </button>
              );
            })}

            <div className="my-2 border-t border-line" />
          </>
        )}

        {/* Online (non-friends) */}
        <SectionLabel>Online now — {otherOnline.length}</SectionLabel>
        {otherOnline.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-ink-4">No one else online</p>
        )}
        {otherOnline.map((u) => (
          <button
            key={u.id}
            data-testid="user-item"
            className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface2 ${activeChatId === u.id ? 'bg-surface2 ring-1 ring-inset ring-line' : ''}`}
            onClick={() => navigate(`/app/chat/${u.id}`)}
          >
            <div
              className="relative flex-shrink-0"
              onClick={u.is_guest ? undefined : (e) => { e.stopPropagation(); setProfileUserId(u.id); }}
              title={u.is_guest ? undefined : 'View profile'}
            >
              <Avatar src={u.avatar_url} name={u.display_name} size="md" />
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-bg"
                style={{ background: 'var(--good)' }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{u.display_name}</p>
              {u.is_guest
                ? <p className="text-xs text-ink-3">Guest · anonymous</p>
                : <UserMeta gender={u.gender} age={u.age} status="Online now" />
              }
            </div>
            <UnreadBadge id={u.id} />
            {!isGuest && !u.is_guest && (
              <span
                data-testid="add-friend-btn"
                onClick={(e) => handleAddFriend(e, u.id)}
                role="button"
                tabIndex={0}
                title="Add Friend"
                className="grid h-7 w-7 place-items-center rounded-lg text-accent opacity-0 transition-all hover:bg-accent-soft group-hover:opacity-100"
              >
                {addingFriend === u.id ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 20a6 6 0 0 1 12 0v1H3v-1Z"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Me footer */}
      {me && (
        <footer className="flex items-center gap-3 border-t border-line px-4 py-3">
          <Avatar src={me.avatar_url} name={me.display_name} size="sm" ring />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{me.display_name}</div>
            <div className="mono flex items-center gap-1.5 text-[10.5px] tracking-wide text-good">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--good)' }} />
              {isGuest ? 'GUEST · ONLINE' : 'ONLINE'}
            </div>
          </div>
        </footer>
      )}

      {profileUserId && (
        <ProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
};
