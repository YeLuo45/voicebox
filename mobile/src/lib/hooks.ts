import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generate,
  getHistoryItem,
  listCaptures,
  listHistory,
  listProfiles,
  type CaptureListResponse,
  type GenerateRequest,
  type GenerationResponse,
  type HistoryListResponse,
  type HistoryResponse,
  type VoiceProfileResponse,
} from './api';
import { useSession } from './session';

export const CAPTURES_KEY = ['captures'] as const;
export const PROFILES_KEY = ['profiles'] as const;
export const HISTORY_KEY = ['history'] as const;

/**
 * Paginated capture list. V0 just fetches the first 50 and refetches on
 * window focus / explicit invalidation. Pagination + virtualized list
 * land when the user actually accumulates enough captures to need them.
 */
export function useCaptures() {
  const session = useSession((s) => s.session);
  return useQuery({
    queryKey: CAPTURES_KEY,
    queryFn: async (): Promise<CaptureListResponse> => {
      if (!session) return { items: [], total: 0 };
      return listCaptures(session, { limit: 50 });
    },
    enabled: !!session,
  });
}

export function useInvalidateCaptures() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CAPTURES_KEY });
}

/** Voice profiles (cloned + preset). */
export function useProfiles() {
  const session = useSession((s) => s.session);
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: async (): Promise<VoiceProfileResponse[]> => {
      if (!session) return [];
      return listProfiles(session);
    },
    enabled: !!session,
    staleTime: 30_000,
  });
}

/** Recent generations (most recent first). */
export function useHistory(limit = 20) {
  const session = useSession((s) => s.session);
  return useQuery({
    queryKey: [...HISTORY_KEY, limit] as const,
    queryFn: async (): Promise<HistoryListResponse> => {
      if (!session) return { items: [], total: 0 };
      return listHistory(session, { limit });
    },
    enabled: !!session,
  });
}

/**
 * Trigger a new generation. The mutation returns the generation row in its
 * initial state — callers should follow up with ``useGenerationPolling``
 * to await completion.
 */
export function useGenerate() {
  const session = useSession((s) => s.session);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: GenerateRequest): Promise<GenerationResponse> => {
      if (!session) throw new Error('Not paired');
      return generate(session, req);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
    },
  });
}

/**
 * Poll a single generation row until it completes or fails. Stops polling
 * automatically once a terminal state is reached, so it's cheap to leave
 * mounted with a null id.
 */
export function useGenerationPolling(generationId: string | null) {
  const session = useSession((s) => s.session);
  return useQuery({
    queryKey: ['generation', generationId] as const,
    queryFn: async (): Promise<HistoryResponse | null> => {
      if (!session || !generationId) return null;
      return getHistoryItem(session, generationId);
    },
    enabled: !!session && !!generationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1500;
      if (data.status === 'completed' || data.status === 'failed') return false;
      return 1500;
    },
  });
}
