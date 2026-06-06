import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import type { Friend, FriendRequest } from '../lib/types';

export const Friends: React.FC = () => {
  const { isGuest } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    if (isGuest) {
      navigate('/app', { replace: true });
    }
  }, [isGuest, navigate]);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get<Friend[]>('/friends'), api.get<FriendRequest[]>('/friends/requests')])
      .then(([f, r]) => {
        setFriends(f);
        setRequests(r);
      })
      .catch(() => toast('Failed to load friends', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleAccept = async (reqId: string) => {
    try {
      await api.post(`/friends/accept/${reqId}`);
      const req = requests.find((r) => r.id === reqId);
      if (req) {
        setFriends((prev) => [...prev, { user: req.requester, friendship_id: reqId }]);
      }
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      toast('Friend request accepted!', 'success');
    } catch {
      toast('Failed to accept request', 'error');
    }
  };

  const handleDecline = async (reqId: string) => {
    try {
      await api.delete(`/friends/decline/${reqId}`);
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      toast('Request declined', 'info');
    } catch {
      toast('Failed to decline request', 'error');
    }
  };

  const handleUnfriend = async (userId: string) => {
    if (!confirm('Remove this friend?')) return;
    try {
      await api.delete(`/friends/${userId}`);
      setFriends((prev) => prev.filter((f) => f.user.id !== userId));
      toast('Unfriended', 'info');
    } catch {
      toast('Failed to unfriend', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `relative px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
      active ? 'border-accent text-accent' : 'border-transparent text-ink-3 hover:text-ink-2'
    }`;

  return (
    <div className="mx-auto max-w-lg overflow-y-auto p-6">
      <h1 className="font-display mb-4 text-2xl font-semibold tracking-tight text-ink">Friends</h1>

      {/* Tabs */}
      <div className="mb-4 flex border-b border-line">
        <button onClick={() => setActiveTab('friends')} className={tabClass(activeTab === 'friends')}>
          Friends ({friends.length})
        </button>
        <button onClick={() => setActiveTab('requests')} className={tabClass(activeTab === 'requests')}>
          Requests
          {requests.length > 0 && (
            <span
              className="ml-1.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold text-accent-ink"
              style={{ background: 'var(--accent)' }}
            >
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends list */}
      {activeTab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-4">No friends yet. Say hi to someone online!</p>
          )}
          {friends.map((f) => (
            <div
              key={f.friendship_id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-lineHi"
            >
              <Avatar src={f.user.avatar_url} name={f.user.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{f.user.display_name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/app/chat/${f.user.id}`)}
                  className="btn-secondary h-8 px-3 text-xs"
                >
                  Chat
                </button>
                <button
                  onClick={() => handleUnfriend(f.user.id)}
                  className="rounded-lg px-2 py-1 text-xs text-warn transition-colors hover:bg-surface2"
                >
                  Unfriend
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Friend requests */}
      {activeTab === 'requests' && (
        <div className="space-y-2">
          {requests.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-4">No pending friend requests</p>
          )}
          {requests.map((req) => (
            <div
              key={req.id}
              data-testid="friend-request-item"
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
            >
              <Avatar src={req.requester.avatar_url} name={req.requester.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{req.requester.display_name}</p>
                <p className="text-xs text-ink-4">{new Date(req.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="accept-friend"
                  onClick={() => handleAccept(req.id)}
                  className="btn-primary h-8 px-3 text-xs"
                >
                  Accept
                </button>
                <button onClick={() => handleDecline(req.id)} className="btn-secondary h-8 px-3 text-xs">
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
