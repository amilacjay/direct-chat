import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Fetch a friends-only (auth-gated) image as a blob and expose it as an object
// URL, revoking it on change/unmount. `path` null means "nothing to load".
export function useBlobUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    api
      .getBlob(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return url;
}
