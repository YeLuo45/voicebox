import { create } from 'zustand';
import {
  clearStoredSession,
  loadSession,
  saveSession,
  type StoredSession,
} from './storage';

type SessionState = {
  session: StoredSession | null;
  hydrated: boolean;        // true after the first SecureStore read completes
  hydrate: () => Promise<void>;
  setSession: (s: StoredSession) => Promise<void>;
  clear: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  hydrated: false,
  async hydrate() {
    if (get().hydrated) return;
    const session = await loadSession();
    set({ session, hydrated: true });
  },
  async setSession(s) {
    await saveSession(s);
    set({ session: s });
  },
  async clear() {
    await clearStoredSession();
    set({ session: null });
  },
}));
