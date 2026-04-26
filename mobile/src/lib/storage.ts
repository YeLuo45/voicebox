import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'voicebox.session.v1';

export type StoredSession = {
  host: string;        // e.g. "192.168.1.5:17494" or "mac.tail-xxxx.ts.net:17493"
  bearer: string;      // long-lived bearer returned from POST /pair/complete
  deviceId: string;
  deviceName: string;
};

export async function loadSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    // Stored blob is corrupt — wipe so the user re-pairs cleanly
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
