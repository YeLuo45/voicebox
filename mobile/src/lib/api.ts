import type { StoredSession } from './storage';

// Voicebox HTTP client. V0 transport is plain HTTP-over-LAN/Tailscale with a
// bearer header. Phase 2 will wrap payloads in XChaCha20-Poly1305 — this
// module is the single chokepoint for that future change.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export type PairCompleteResponse = {
  device_id: string;
  bearer: string;
  device_name: string;
};

export type MeResponse = {
  device_id: string;
  device_name: string;
  last_seen_at: string | null;
};

function buildUrl(host: string, path: string): string {
  // host may include a port (e.g. "192.168.1.5:17494"); just slap http:// on.
  // Phase 2 should require https or self-signed-with-pinned-fp; for V0 plain
  // HTTP over a trusted LAN/Tailnet is the deal we made.
  return `http://${host}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    return JSON.stringify(body);
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

// --- Unauthenticated (pre-pair) ---------------------------------------------

export async function completePair(
  host: string,
  token: string,
  deviceName: string,
): Promise<PairCompleteResponse> {
  const res = await fetch(buildUrl(host, '/pair/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, device_name: deviceName }),
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return (await res.json()) as PairCompleteResponse;
}

// --- Authenticated (post-pair) ----------------------------------------------

async function authedFetch(
  session: StoredSession,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.bearer}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(buildUrl(session.host, path), { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return res;
}

export async function getMe(session: StoredSession): Promise<MeResponse> {
  const res = await authedFetch(session, '/me');
  return (await res.json()) as MeResponse;
}

// --- Captures ---------------------------------------------------------------

export type CaptureSource = 'dictation' | 'recording' | 'file';

export type CaptureResponse = {
  id: string;
  audio_path: string;
  source: CaptureSource;
  language: string | null;
  duration_ms: number | null;
  transcript_raw: string;
  transcript_refined: string | null;
  stt_model: string | null;
  llm_model: string | null;
  created_at: string;
};

export type CaptureListResponse = {
  items: CaptureResponse[];
  total: number;
};

export type CaptureCreateResponse = CaptureResponse & {
  auto_refine: boolean;
  allow_auto_paste: boolean;
};

export async function listCaptures(
  session: StoredSession,
  opts: { limit?: number; offset?: number } = {},
): Promise<CaptureListResponse> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const qs = params.toString();
  const res = await authedFetch(session, `/captures${qs ? `?${qs}` : ''}`);
  return (await res.json()) as CaptureListResponse;
}

export async function uploadCapture(
  session: StoredSession,
  audioUri: string,
  opts: { filename?: string; mimeType?: string; source?: CaptureSource } = {},
): Promise<CaptureCreateResponse> {
  const filename = opts.filename ?? 'capture.m4a';
  const mimeType = opts.mimeType ?? 'audio/m4a';
  const source = opts.source ?? 'dictation';

  const form = new FormData();
  // React Native's FormData accepts {uri, name, type} for file fields; the
  // typing pretends it doesn't, so we cast.
  form.append('file', {
    uri: audioUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
  form.append('source', source);

  const res = await authedFetch(session, '/captures', {
    method: 'POST',
    body: form,
  });
  return (await res.json()) as CaptureCreateResponse;
}

export async function deleteCapture(
  session: StoredSession,
  captureId: string,
): Promise<void> {
  await authedFetch(session, `/captures/${captureId}`, { method: 'DELETE' });
}

export function buildCaptureAudioUrl(session: StoredSession, captureId: string): string {
  return buildUrl(session.host, `/captures/${captureId}/audio`);
}

// --- Voice profiles ---------------------------------------------------------

export type VoiceProfileResponse = {
  id: string;
  name: string;
  description: string | null;
  language: string;
  avatar_path: string | null;
  voice_type: 'cloned' | 'preset' | 'designed';
  preset_engine: string | null;
  preset_voice_id: string | null;
  default_engine: string | null;
  generation_count: number;
  sample_count: number;
  created_at: string;
  updated_at: string;
};

export async function listProfiles(session: StoredSession): Promise<VoiceProfileResponse[]> {
  const res = await authedFetch(session, '/profiles');
  return (await res.json()) as VoiceProfileResponse[];
}

// --- Generations ------------------------------------------------------------

export type GenerationStatus = 'pending' | 'completed' | 'failed';

export type GenerationResponse = {
  id: string;
  profile_id: string;
  text: string;
  language: string;
  audio_path: string | null;
  duration: number | null;
  seed: number | null;
  engine: string | null;
  status: GenerationStatus | string;
  error: string | null;
  is_favorited: boolean;
  created_at: string;
};

export type HistoryResponse = GenerationResponse & {
  profile_name: string;
};

export type HistoryListResponse = {
  items: HistoryResponse[];
  total: number;
};

export type GenerateRequest = {
  profile_id: string;
  text: string;
  language?: string;
  engine?: string;
  seed?: number;
  personality?: boolean;
};

export async function generate(
  session: StoredSession,
  req: GenerateRequest,
): Promise<GenerationResponse> {
  const res = await authedFetch(session, '/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return (await res.json()) as GenerationResponse;
}

export async function getHistoryItem(
  session: StoredSession,
  generationId: string,
): Promise<HistoryResponse> {
  const res = await authedFetch(session, `/history/${generationId}`);
  return (await res.json()) as HistoryResponse;
}

export async function listHistory(
  session: StoredSession,
  opts: { limit?: number; offset?: number; profile_id?: string } = {},
): Promise<HistoryListResponse> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.profile_id) params.set('profile_id', opts.profile_id);
  const qs = params.toString();
  const res = await authedFetch(session, `/history${qs ? `?${qs}` : ''}`);
  return (await res.json()) as HistoryListResponse;
}

export function buildGenerationAudioUrl(
  session: StoredSession,
  generationId: string,
): string {
  return buildUrl(session.host, `/audio/${generationId}`);
}

/**
 * Authentication header for streaming sources where a separate fetch isn't
 * possible (expo-audio's source object accepts headers directly).
 */
export function authHeaders(session: StoredSession): Record<string, string> {
  return { Authorization: `Bearer ${session.bearer}` };
}
