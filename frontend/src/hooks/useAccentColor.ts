import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';

export const DEFAULT_HUE = 285;

export function applyAccentHue(hue: number | null | undefined) {
  const h = hue ?? DEFAULT_HUE;
  document.documentElement.style.setProperty('--accent-h', String(h));
}

export function useAccentColor() {
  const accentHue = useAuthStore((s) => s.user?.accent_hue);
  useEffect(() => {
    applyAccentHue(accentHue);
  }, [accentHue]);
}
