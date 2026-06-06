import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { PublicUser } from '../lib/types';
import { Avatar } from './Avatar';
import { GenderIcon, genderColor, genderLabel } from './GenderIcon';

interface Props {
  userId: string;
  onClose: () => void;
}

export const ProfileModal: React.FC<Props> = ({ userId, onClose }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    if (userId.startsWith('guest:')) {
      setProfile(null);
      setLoading(false);
      return;
    }
    api
      .get<PublicUser>(`/users/${userId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleMessage = () => {
    navigate(`/app/chat/${userId}`);
    onClose();
  };

  const isGuest = userId.startsWith('guest:');

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-bg shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface2 text-ink-3 transition-colors hover:text-ink"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
          </div>
        ) : isGuest || !profile ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10">
            <Avatar
              src={null}
              name={isGuest ? 'Guest' : '?'}
              size="lg"
            />
            <p className="text-base font-semibold text-ink">Guest user</p>
            <p className="text-sm text-ink-4">No profile available for guest users.</p>
            <button onClick={handleMessage} className="btn-primary mt-2 px-6">
              Message
            </button>
          </div>
        ) : (
          <>
            {/* Avatar band */}
            <div className="flex flex-col items-center gap-3 bg-surface px-6 pb-5 pt-8">
              <Avatar src={profile.avatar_url} name={profile.display_name} size="lg" />
              <div className="text-center">
                <p className="text-lg font-bold text-ink">{profile.display_name}</p>
                {(profile.gender || profile.age) && (
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-sm">
                    {profile.gender && (
                      <span className={`flex items-center gap-0.5 ${genderColor[profile.gender] ?? 'text-ink-3'}`}>
                        <GenderIcon gender={profile.gender} className="h-4 w-4" />
                        <span>{genderLabel[profile.gender] ?? profile.gender}</span>
                      </span>
                    )}
                    {profile.gender && profile.age && (
                      <span className="text-ink-4">·</span>
                    )}
                    {profile.age && (
                      <span className="text-ink-3">{profile.age} yo</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 px-6 py-5">
              {profile.bio && (
                <p className="text-sm leading-relaxed text-ink-2">{profile.bio}</p>
              )}

              {profile.location && (
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="currentColor" />
                  </svg>
                  {profile.location}
                </div>
              )}

              {profile.created_at && (
                <div className="flex items-center gap-2 text-xs text-ink-4">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth={2} />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                  Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </div>
              )}

              {!profile.bio && !profile.location && !profile.gender && !profile.age && (
                <p className="text-sm text-ink-4">No profile details yet.</p>
              )}
            </div>

            {/* Action */}
            <div className="border-t border-line px-6 py-4">
              <button onClick={handleMessage} className="btn-primary w-full">
                Message
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
