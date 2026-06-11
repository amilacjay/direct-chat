import React from 'react';
import { useBlobUrl } from '../hooks/useBlobUrl';

interface Props {
  path: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

// Renders an auth-gated album/background image fetched as a blob. Shows a
// shimmer placeholder until the bytes arrive.
export const AlbumImg: React.FC<Props> = ({ path, alt = '', className = '', onClick }) => {
  const url = useBlobUrl(path);
  if (!url) {
    return <div className={`animate-pulse bg-surface2 ${className}`} aria-hidden />;
  }
  return <img src={url} alt={alt} onClick={onClick} className={className} />;
};
