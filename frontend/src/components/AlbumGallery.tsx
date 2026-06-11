import React, { useEffect, useState } from 'react';
import type { Album } from '../lib/types';
import { albumsApi } from '../lib/albums';
import { AlbumImg } from './AlbumImg';

interface Props {
  albums: Album[];
  // Lets the preview show the owner's own images while chat shows the peer's;
  // both resolve to the auth-gated /albums/image/{id} path.
  imagePath?: (imageId: string) => string;
  className?: string;
}

// The "top half" album viewer: each album is a labelled row of thumbnails.
// Tapping a thumbnail opens a fullscreen lightbox.
export const AlbumGallery: React.FC<Props> = ({ albums, imagePath = albumsApi.imagePath, className = '' }) => {
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const withImages = albums.filter((a) => a.images.length > 0);
  if (withImages.length === 0) return null;

  return (
    <div className={`overflow-y-auto ${className}`}>
      <div className="flex flex-col gap-4 p-3">
        {withImages.map((album) => (
          <div key={album.id}>
            <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {album.title}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {album.images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setLightbox(img.id)}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ring-line transition-transform hover:scale-[1.03]"
                >
                  <AlbumImg path={imagePath(img.id)} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <AlbumImg
            path={imagePath(lightbox)}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
