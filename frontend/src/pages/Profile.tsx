import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import type { PublicUser } from '../lib/types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

export const Profile: React.FC = () => {
  const { user, isGuest, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');

  useEffect(() => {
    if (isGuest) {
      navigate('/app', { replace: true });
    }
  }, [isGuest, navigate]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setBio(user.bio ?? '');
      setLocation(user.location ?? '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<PublicUser>('/users/me', {
        display_name: displayName,
        bio: bio || undefined,
        location: location || undefined,
      });
      setUser(updated);
      toast('Profile saved!', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError('');

    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Avatar must be under 2 MB');
      e.target.value = '';
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAvatarError('Only JPEG, PNG, GIF, WebP images are allowed');
      e.target.value = '';
      return;
    }

    // Preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const updated = await api.postForm<PublicUser>('/users/me/avatar', formData);
      setUser(updated);
      setAvatarPreview(null);
      toast('Avatar updated!', 'success');
    } catch {
      setAvatarPreview(null);
      setAvatarError('Failed to upload avatar');
      toast('Failed to upload avatar', 'error');
    }

    e.target.value = '';
  };

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          <Avatar
            src={avatarPreview ?? user.avatar_url}
            name={user.display_name}
            size="lg"
            className="cursor-pointer"
          />
          <div
            onClick={handleAvatarClick}
            className="absolute inset-0 rounded-full bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user.display_name}</p>
          <button
            onClick={handleAvatarClick}
            className="text-sm text-blue-600 hover:underline"
          >
            Change avatar
          </button>
          {avatarError && (
            <p className="text-red-500 text-xs mt-1">{avatarError}</p>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            data-testid="display-name-input"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="^[A-Za-z0-9 _-]+$"
            className="input"
            placeholder="Your display name"
          />
          <p className="text-xs text-gray-400 mt-1">3–30 chars, letters, numbers, spaces, _ or -</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            data-testid="bio-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={200}
            className="input resize-none"
            placeholder="Tell others a bit about yourself"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            className="input"
            placeholder="City, Country"
          />
        </div>

        <div className="pt-2">
          <button
            data-testid="save-profile"
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};
