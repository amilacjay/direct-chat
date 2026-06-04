import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { wsClient } from '../lib/websocket';
import { useAuthStore } from '../store/auth';
import { useChatStore } from '../store/chat';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import type { Friend, OnlineUser } from '../lib/types';
import type { WsPresenceSnapshot, WsPresenceJoin, WsPresenceLeave } from '../lib/types';

export const OnlineUsers: React.FC = () => {
  const navigate = useNavigate();
  const { user: me, isGuest } = useAuthStore();
  const unread = useChatStore((s) => s.unread);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    api.get<OnlineUser[]>('/users/online').then(setOnlineUsers).catch(() => {});
  }, []);

  // Friends (registered users only)
  useEffect(() => {
    if (isGuest) return;
    api.get<Friend[]>('/friends').then(setFriends).catch(() => {});
  }, [isGuest]);

  // WS presence events
  const handlePresence = useCallback(
    (msg: WsPresenceSnapshot | WsPresenceJoin | WsPresenceLeave) => {
      if (msg.data.event === 'snapshot') {
        setOnlineUsers(msg.data.users);
      } else if (msg.data.event === 'join') {
        const joined = msg.data.user;
        setOnlineUsers((prev) =>
          prev.find((u) => u.id === joined.id) ? prev : [...prev, joined]
        );
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
      // ignore (might already be a friend / pending)
    } finally {
      setAddingFriend(null);
    }
  };

  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  const friendIds = new Set(friends.map((f) => f.user.id));

  // Friends sorted online-first; "Online" section excludes me and existing friends.
  const friendRows = [...friends].sort(
    (a, b) => Number(onlineIds.has(b.user.id)) - Number(onlineIds.has(a.user.id))
  );
  const otherOnline = onlineUsers.filter(
    (u) => u.id !== me?.id && !friendIds.has(u.id)
  );

  const UnreadBadge: React.FC<{ id: string }> = ({ id }) =>
    (unread[id] ?? 0) > 0 ? (
      <span
        data-testid="unread-badge"
        className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
      >
        {unread[id] > 9 ? '9+' : unread[id]}
      </span>
    ) : null;

  return (
    <div
      data-testid="online-users"
      className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col"
    >
      <div className="flex-1 overflow-y-auto py-2">
        {/* Friends */}
        {!isGuest && (
          <>
            <div className="px-4 py-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Friends — {friends.length}
              </h2>
            </div>
            {friends.length === 0 && (
              <p className="px-4 pb-2 text-sm text-gray-400 text-center">No friends yet</p>
            )}
            {friendRows.map((f) => {
              const online = onlineIds.has(f.user.id);
              return (
                <div
                  key={f.friendship_id}
                  data-testid="user-item"
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-lg mx-1 transition-colors"
                  onClick={() => navigate(`/app/chat/${f.user.id}`)}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar src={f.user.avatar_url} name={f.user.display_name} size="sm" />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        online ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.user.display_name}</p>
                    <p className="text-xs text-gray-400">{online ? 'Online' : 'Offline'}</p>
                  </div>
                  <UnreadBadge id={f.user.id} />
                </div>
              );
            })}

            <div className="border-t border-gray-100 my-2" />
          </>
        )}

        {/* Online (non-friends) */}
        <div className="px-4 py-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Online — {otherOnline.length}
          </h2>
        </div>
        {otherOnline.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No one else online</p>
        )}
        {otherOnline.map((u) => (
          <div
            key={u.id}
            data-testid="user-item"
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer rounded-lg mx-1 group transition-colors"
            onClick={() => navigate(`/app/chat/${u.id}`)}
          >
            <div className="relative flex-shrink-0">
              <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{u.display_name}</p>
              {u.is_guest && <Badge variant="gray">Guest</Badge>}
            </div>
            <UnreadBadge id={u.id} />
            {/* Add Friend button for registered targets */}
            {!isGuest && !u.is_guest && (
              <button
                data-testid="add-friend-btn"
                onClick={(e) => handleAddFriend(e, u.id)}
                disabled={addingFriend === u.id}
                title="Add Friend"
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-100 text-blue-500 transition-all"
              >
                {addingFriend === u.id ? (
                  <span className="text-xs">...</span>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
