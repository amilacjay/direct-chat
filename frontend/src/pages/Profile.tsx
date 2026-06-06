import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import type { PublicUser } from '../lib/types';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

export const Profile: React.FC = () => {
  const { user, isGuest, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [age, setAge] = useState<string>(user?.age != null ? String(user.age) : '');
  const [showGender, setShowGender] = useState(user?.show_gender ?? true);
  const [showAge, setShowAge] = useState(user?.show_age ?? true);
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
      setGender(user.gender ?? '');
      setAge(user.age != null ? String(user.age) : '');
      setShowGender(user.show_gender ?? true);
      setShowAge(user.show_age ?? true);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ageNum = age.trim() !== '' ? parseInt(age, 10) : null;
      if (ageNum !== null && (isNaN(ageNum) || ageNum < 1 || ageNum > 120)) {
        toast('Age must be between 1 and 120', 'error');
        setSaving(false);
        return;
      }
      const updated = await api.patch<PublicUser>('/users/me', {
        display_name: displayName,
        bio: bio || undefined,
        location: location || undefined,
        gender: gender || null,
        age: ageNum,
        show_gender: showGender,
        show_age: showAge,
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
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {/* Mobile header */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-line px-2 py-2 md:hidden">
        <button
          onClick={() => navigate('/app')}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-surface2"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight text-ink">Profile</h1>
      </div>
    <div className="flex-1 overflow-y-auto">
    <div className="mx-auto max-w-lg p-6">
      <h1 className="font-display mb-6 hidden text-2xl font-semibold tracking-tight text-ink md:block">Profile</h1>

      {/* Avatar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="group relative">
          <Avatar
            src={avatarPreview ?? user.avatar_url}
            name={user.display_name}
            size="lg"
            className="cursor-pointer"
            ring
          />
          <div
            onClick={handleAvatarClick}
            className="absolute inset-0 grid cursor-pointer place-items-center rounded-[22px] bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="font-semibold text-ink">{user.display_name}</p>
          <button onClick={handleAvatarClick} className="text-sm text-accent hover:underline">
            Change avatar
          </button>
          {avatarError && <p className="mt-1 text-xs text-warn">{avatarError}</p>}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-2">
            Display Name <span className="text-warn">*</span>
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
          <p className="mt-1 text-xs text-ink-4">3–30 chars, letters, numbers, spaces, _ or -</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-2">Bio</label>
          <textarea
            data-testid="bio-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={200}
            className="input resize-none py-2.5"
            placeholder="Tell others a bit about yourself"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink-2">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            className="input"
            placeholder="City, Country"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-2">Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} className="input">
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {gender && (
            <label className="mt-2 flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={showGender}
                onChange={(e) => setShowGender(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--accent)]"
              />
              <span className="text-sm text-ink-3">Show gender on my profile</span>
            </label>
          )}
        </div>

        {/* Age */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-2">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min={1}
            max={120}
            className="input"
            placeholder="Your age"
          />
          {age.trim() !== '' && (
            <label className="mt-2 flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={showAge}
                onChange={(e) => setShowAge(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--accent)]"
              />
              <span className="text-sm text-ink-3">Show age on my profile</span>
            </label>
          )}
        </div>

        <div className="pt-2">
          <button data-testid="save-profile" type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
    </div>
    </div>
  );
};
