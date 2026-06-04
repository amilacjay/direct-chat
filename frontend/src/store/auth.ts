import { create } from 'zustand';
import type { PublicUser } from '../lib/types';

interface AuthState {
  token: string | null;
  user: PublicUser | null;
  isGuest: boolean;
  login: (token: string, user: PublicUser, isGuest: boolean) => void;
  logout: () => void;
  setUser: (user: PublicUser) => void;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

function loadFromStorage(): { token: string | null; user: PublicUser | null; isGuest: boolean } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? (JSON.parse(userStr) as PublicUser) : null;
    const isGuest = user?.is_guest ?? false;
    return { token, user, isGuest };
  } catch {
    return { token: null, user: null, isGuest: false };
  }
}

const initial = loadFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  user: initial.user,
  isGuest: initial.isGuest,

  login: (token, user, isGuest) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, isGuest });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isGuest: false });
  },

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));
