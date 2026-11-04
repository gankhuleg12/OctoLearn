import { create } from 'zustand';

import { configureApiClient } from '@/api/client';
import { api } from '@/api/endpoints';
import type { Session, User } from '@/api/types';
import { secureStorage } from '@/lib/secure-storage';

const SESSION_KEY = 'octolearn.session';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: User | null;
  /** Reads the saved session on app start. */
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const logoutListeners = new Set<() => void>();
/** Lets other stores clear user-specific caches on logout without an import cycle. */
export function onLogout(fn: () => void) {
  logoutListeners.add(fn);
  return () => logoutListeners.delete(fn);
}

export const useAuth = create<AuthState>((set, get) => {
  async function startSession(session: Session) {
    await secureStorage.set(SESSION_KEY, JSON.stringify(session));
    set({ status: 'signedIn', token: session.token, user: session.user });
  }

  return {
    status: 'loading',
    token: null,
    user: null,

    async hydrate() {
      try {
        const raw = await secureStorage.get(SESSION_KEY);
        const session = raw ? (JSON.parse(raw) as Session) : null;
        if (session?.token) set({ status: 'signedIn', token: session.token, user: session.user });
        else set({ status: 'signedOut' });
      } catch {
        set({ status: 'signedOut' });
      }
    },

    async login(email, password) {
      await startSession(await api.login(email.trim(), password));
    },

    async register(name, email, password) {
      await startSession(await api.register(name.trim(), email.trim(), password));
    },

    async logout() {
      await secureStorage.remove(SESSION_KEY).catch(() => {});
      logoutListeners.forEach((fn) => fn());
      set({ status: 'signedOut', token: null, user: null });
    },

    setUser(user) {
      const { token } = get();
      set({ user });
      if (token) secureStorage.set(SESSION_KEY, JSON.stringify({ token, user })).catch(() => {});
    },
  };
});

configureApiClient({
  getToken: () => useAuth.getState().token,
  // Expired / revoked token: drop the session so the app shows the login screen.
  onUnauthorized: () => {
    useAuth.getState().logout();
  },
});
