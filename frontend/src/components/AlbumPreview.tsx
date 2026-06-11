import React, { useEffect } from 'react';
import type { Album } from '../lib/types';
import { albumsApi } from '../lib/albums';
import { AlbumGallery } from './AlbumGallery';
import { AlbumImg } from './AlbumImg';

interface Props {
  albums: Album[];
  // The owner's user id — used to load their background through the auth-gated path.
  ownerId: string;
  hasBackground: boolean;
  onClose: () => void;
}

// Shows how the owner's chat looks to a friend: their background behind the
// thread, albums up top, chat history + composer below. Read-only mock.
export const AlbumPreview: React.FC<Props> = ({ albums, ownerId, hasBackground, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bgPath = hasBackground ? albumsApi.backgroundPath(ownerId) : null;
  const hasAlbums = albums.some((a) => a.images.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-line bg-bg shadow-2xl">
        {/* Background layer */}
        {bgPath && (
          <AlbumImg path={bgPath} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/20 to-bg/80" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-line/60 px-4 py-3 backdrop-blur-md">
          <span className="text-sm font-semibold text-ink">Preview — how friends see your chat</span>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-ink-3 hover:text-ink"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Top half — albums */}
        <div className="relative z-10 h-1/2 border-b border-line/60">
          {hasAlbums ? (
            <AlbumGallery albums={albums} className="h-full" />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-3">
              Your albums will appear here. Add some images to show them off.
            </div>
          )}
        </div>

        {/* Bottom half — mock chat */}
        <div className="relative z-10 flex h-1/2 flex-col">
          <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
            <div className="self-start rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2 text-[14px] text-ink shadow-soft">
              Hey! Love your photos 😍
            </div>
            <div
              className="self-end rounded-2xl rounded-br-md px-3.5 py-2 text-[14px] shadow-soft"
              style={{ background: 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))', color: 'var(--on-accent)' }}
            >
              Thanks! 😊
            </div>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-3xl border border-line bg-surface/90 p-1.5 shadow-soft backdrop-blur">
              <div className="flex-1 px-2 py-2 text-sm text-ink-4">Message…</div>
              <div
                className="grid h-9 w-9 place-items-center rounded-2xl"
                style={{ background: 'linear-gradient(180deg, var(--accent-hi), var(--accent-lo))', color: 'var(--on-accent)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M7 11L17 6.2a.6.6 0 0 1 .82.78l-4.5 11.4a.6.6 0 0 1-1.1.04L10.5 13.5 7 11Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
