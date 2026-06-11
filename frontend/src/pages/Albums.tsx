import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/Toast';
import { albumsApi } from '../lib/albums';
import { AlbumImg } from '../components/AlbumImg';
import { AlbumPreview } from '../components/AlbumPreview';
import type { Album, MyAlbums } from '../lib/types';

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

export const Albums: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [data, setData] = useState<MyAlbums | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  // One hidden input for album image uploads (target tracked) + one for background.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const refresh = () => albumsApi.mine().then(setData).catch(() => toast('Failed to load albums', 'error'));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (file: File): string | null => {
    if (!ALLOWED.includes(file.type)) return 'Only JPEG, PNG, GIF, WebP allowed';
    if (data && file.size > data.usage.max_image_bytes)
      return `Image must be under ${mb(data.usage.max_image_bytes)} MB`;
    return null;
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      await albumsApi.create('Album');
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create album', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (album: Album, title: string) => {
    if (title.trim() === album.title || !title.trim()) return;
    try {
      await albumsApi.update(album.id, { title: title.trim() });
      await refresh();
    } catch {
      toast('Rename failed', 'error');
    }
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!window.confirm(`Delete "${album.title}" and its photos?`)) return;
    try {
      await albumsApi.remove(album.id);
      await refresh();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const pickImage = (albumId: string) => {
    uploadTarget.current = albumId;
    imageInputRef.current?.click();
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const albumId = uploadTarget.current;
    e.target.value = '';
    if (!file || !albumId) return;
    const err = validate(file);
    if (err) return toast(err, 'error');
    setBusy(true);
    try {
      await albumsApi.uploadImage(albumId, file);
      await refresh();
    } catch (er) {
      toast(er instanceof Error ? er.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteImage = async (albumId: string, imageId: string) => {
    try {
      await albumsApi.deleteImage(albumId, imageId);
      await refresh();
    } catch {
      toast('Could not remove image', 'error');
    }
  };

  const handleSetCover = async (albumId: string, imageId: string) => {
    try {
      await albumsApi.update(albumId, { cover_image_id: imageId });
      await refresh();
      toast('Thumbnail updated', 'success');
    } catch {
      toast('Could not set thumbnail', 'error');
    }
  };

  const handleUseAsBackground = async (imageId: string) => {
    try {
      const updated = await albumsApi.setBackgroundFromImage(imageId);
      setData(updated);
      toast('Chat background set', 'success');
    } catch {
      toast('Could not set background', 'error');
    }
  };

  const handleBgSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validate(file);
    if (err) return toast(err, 'error');
    setBusy(true);
    try {
      const updated = await albumsApi.setBackgroundUpload(file);
      setData(updated);
      toast('Chat background set', 'success');
    } catch (er) {
      toast(er instanceof Error ? er.message : 'Could not set background', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleClearBackground = async () => {
    try {
      const updated = await albumsApi.clearBackground();
      setData(updated);
    } catch {
      toast('Could not clear background', 'error');
    }
  };

  if (loading || !user) {
    return (
      <div className="grid h-full place-items-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  const usage = data?.usage;
  const atAlbumLimit = !!usage && usage.album_count >= usage.max_albums;
  const pct = usage ? Math.min(100, Math.round((usage.used_bytes / usage.limit_bytes) * 100)) : 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-line px-2 py-2 md:px-4">
        <button
          onClick={() => navigate('/app')}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-surface2 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight text-ink">Albums &amp; background</h1>
        <button
          onClick={() => setPreview(true)}
          className="btn-secondary ml-auto h-8 px-3 text-xs"
        >
          Preview
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-6 p-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {data?.is_guest && (
            <div className="rounded-2xl border border-accent-line bg-accent-soft p-3 text-[13px] leading-relaxed text-ink-2">
              As a guest you can keep <b>1 album with 3 photos</b>, visible to people you
              chat with while you’re online. They vanish when you leave.
            </div>
          )}

          {/* Quota meter */}
          {usage && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-ink-3">
                <span>Storage used</span>
                <span className="mono">{mb(usage.used_bytes)} / {mb(usage.limit_bytes)} MB</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct > 90 ? 'var(--warn)' : 'var(--accent)' }}
                />
              </div>
            </div>
          )}

          {/* Background section */}
          <section className="rounded-2xl border border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Chat background</h2>
              {data?.has_background && (
                <button onClick={handleClearBackground} className="text-xs text-warn hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ring-line">
                {data?.has_background ? (
                  <AlbumImg path={albumsApi.backgroundPath(user.id)} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-ink-4">None</div>
                )}
              </div>
              <div className="text-xs text-ink-3">
                <p>Shown behind your chat to {data?.is_guest ? 'people you chat with' : 'friends'}.</p>
                {data?.is_guest ? (
                  <p className="mt-2 text-ink-4">Pick an album photo below and choose “Use as BG”.</p>
                ) : (
                  <p className="mt-2">
                    <button
                      onClick={() => bgInputRef.current?.click()}
                      disabled={busy}
                      className="text-accent hover:underline disabled:opacity-50"
                    >
                      Upload image
                    </button>
                    <span className="px-1 text-ink-4">or use an album photo below</span>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Albums */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Albums <span className="text-ink-4">({usage?.album_count ?? 0}/{usage?.max_albums ?? 0})</span>
              </h2>
              <button
                onClick={handleCreate}
                disabled={busy || atAlbumLimit}
                className="btn-secondary h-8 px-3 text-xs disabled:opacity-50"
                title={atAlbumLimit ? 'Album limit reached' : 'New album'}
              >
                + New album
              </button>
            </div>

            {data?.albums.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-ink-4">
                No albums yet. Create one to upload photos.
              </p>
            )}

            {data?.albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                ownerId={user.id}
                backgroundImageId={data.background_image_id ?? null}
                maxImages={usage?.max_images_per_album ?? 0}
                onRename={handleRename}
                onDelete={() => handleDeleteAlbum(album)}
                onAddImage={() => pickImage(album.id)}
                onDeleteImage={handleDeleteImage}
                onSetCover={handleSetCover}
                onUseAsBackground={handleUseAsBackground}
              />
            ))}
          </section>
        </div>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgSelected} />

      {preview && data && (
        <AlbumPreview
          albums={data.albums}
          ownerId={user.id}
          hasBackground={data.has_background}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
};

// --- Album card ---------------------------------------------------------- //
interface CardProps {
  album: Album;
  ownerId: string;
  backgroundImageId: string | null;
  maxImages: number;
  onRename: (album: Album, title: string) => void;
  onDelete: () => void;
  onAddImage: () => void;
  onDeleteImage: (albumId: string, imageId: string) => void;
  onSetCover: (albumId: string, imageId: string) => void;
  onUseAsBackground: (imageId: string) => void;
}

const AlbumCard: React.FC<CardProps> = ({
  album,
  backgroundImageId,
  maxImages,
  onRename,
  onDelete,
  onAddImage,
  onDeleteImage,
  onSetCover,
  onUseAsBackground,
}) => {
  const [title, setTitle] = useState(album.title);
  useEffect(() => setTitle(album.title), [album.title]);
  const full = album.images.length >= maxImages;

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => onRename(album, title)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          maxLength={60}
          className="min-w-0 flex-1 border-none bg-transparent text-sm font-semibold text-ink outline-none"
        />
        <span className="text-xs text-ink-4">{album.images.length}/{maxImages}</span>
        <button onClick={onDelete} title="Delete album" className="text-warn hover:opacity-70">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {album.images.map((img) => {
          const isCover = album.cover_image_id === img.id;
          const isBg = backgroundImageId === img.id;
          return (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-inset ring-line">
              <AlbumImg path={albumsApi.imagePath(img.id)} className="h-full w-full object-cover" />
              {isCover && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">
                  Cover
                </span>
              )}
              {isBg && (
                <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[9px] font-semibold uppercase tracking-wide text-accent-ink">
                  BG
                </span>
              )}
              {/* hover actions */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                {!isCover && (
                  <button onClick={() => onSetCover(album.id, img.id)} className="rounded bg-white/15 px-2 py-0.5 text-[10px] text-white hover:bg-white/25">
                    Set cover
                  </button>
                )}
                {!isBg && (
                  <button onClick={() => onUseAsBackground(img.id)} className="rounded bg-white/15 px-2 py-0.5 text-[10px] text-white hover:bg-white/25">
                    Use as BG
                  </button>
                )}
                <button onClick={() => onDeleteImage(album.id, img.id)} className="rounded bg-warn/80 px-2 py-0.5 text-[10px] text-white hover:bg-warn">
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        {!full && (
          <button
            onClick={onAddImage}
            className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-ink-4 transition-colors hover:border-accent hover:text-accent"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
