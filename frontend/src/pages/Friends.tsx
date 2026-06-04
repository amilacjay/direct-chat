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
    Promise.all([
      api.get<Friend[]>('/friends'),
      api.get<FriendRequest[]>('/friends/requests'),
    ])
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
        setFriends((prev) => [
          ...prev,
          { user: req.requester, friendship_id: reqId },
        ]);
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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Friends</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'friends'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Requests
          {requests.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Friends list */}
      {activeTab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 && (
            <p className="text-gray-400 text-sm py-6 text-center">No friends yet. Say hi to someone online!</p>
          )}
          {friends.map((f) => (
            <div
              key={f.friendship_id}
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
            >
              <Avatar src={f.user.avatar_url} name={f.user.display_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{f.user.display_name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/app/chat/${f.user.id}`)}
                  className="btn-secondary text-xs py-1 px-2"
                >
                  Chat
                </button>
                <button
                  onClick={() => handleUnfriend(f.user.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
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
            <p className="text-gray-400 text-sm py-6 text-center">No pending friend requests</p>
          )}
          {requests.map((req) => (
            <div
              key={req.id}
              data-testid="friend-request-item"
              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
            >
              <Avatar src={req.requester.avatar_url} name={req.requester.display_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">
                  {req.requester.display_name}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="accept-friend"
                  onClick={() => handleAccept(req.id)}
                  className="btn-primary text-xs py-1 px-3"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(req.id)}
                  className="btn-secondary text-xs py-1 px-3"
                >
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
