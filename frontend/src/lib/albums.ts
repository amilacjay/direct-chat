import { api } from './api';
import type { Album, AlbumImage, MyAlbums, PublicAlbums } from './types';

// Album/background images are friends-only, so they are NOT public URLs. Bytes
// are fetched with the bearer token via api.getBlob (see useBlobUrl) — never set
// directly as an <img src> to a public path.
export const albumsApi = {
  mine: () => api.get<MyAlbums>('/albums/me'),
  userAlbums: (userId: string) => api.get<PublicAlbums>(`/albums/user/${userId}`),

  create: (title: string) => api.post<Album>('/albums', { title }),
  update: (id: string, body: { title?: string; cover_image_id?: string | null }) =>
    api.patch<Album>(`/albums/${id}`, body),
  remove: (id: string) => api.delete<void>(`/albums/${id}`),

  uploadImage: (albumId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.postForm<AlbumImage>(`/albums/${albumId}/images`, fd);
  },
  deleteImage: (albumId: string, imageId: string) =>
    api.delete<void>(`/albums/${albumId}/images/${imageId}`),

  setBackgroundUpload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.putForm<MyAlbums>('/albums/background', fd);
  },
  setBackgroundFromImage: (imageId: string) =>
    api.put<MyAlbums>(`/albums/background/from-image/${imageId}`),
  clearBackground: () => api.delete<MyAlbums>('/albums/background'),

  // Blob-fetch paths (consumed by useBlobUrl).
  imagePath: (imageId: string) => `/albums/image/${imageId}`,
  backgroundPath: (userId: string) => `/albums/background/${userId}`,
};
