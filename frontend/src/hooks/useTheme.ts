import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const KEY = 'direct-theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  // Brief crossfade
  root.classList.add('theming');
  root.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => root.classList.remove('theming'), 500);
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => {
  // Ensure DOM matches store on first import (index.html already set it pre-paint).
  const start = initial();
  document.documentElement.setAttribute('data-theme', start);

  return {
    theme: start,
    setTheme: (t) => {
      apply(t);
      set({ theme: t });
    },
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      apply(next);
      set({ theme: next });
    },
  };
});
