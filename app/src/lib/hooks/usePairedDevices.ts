import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const PAIRED_DEVICES_KEY = ['paired-devices'] as const;
export const PAIR_HOST_CANDIDATES_KEY = ['pair-host-candidates'] as const;

/**
 * List all paired (and revoked) devices. Pass ``polling: true`` while the
 * pair dialog is open so the device list refreshes when the user finishes
 * scanning on their phone — this is how the desktop UI detects success
 * without needing an SSE stream.
 */
export function usePairedDevices({ polling = false }: { polling?: boolean } = {}) {
  return useQuery({
    queryKey: PAIRED_DEVICES_KEY,
    queryFn: () => apiClient.listPairedDevices(),
    refetchInterval: polling ? 2000 : false,
  });
}

/**
 * The candidate addresses the desktop can embed in the QR (LAN, Tailscale,
 * loopback). Cached for the lifetime of the dialog — interfaces don't
 * change often enough to be worth re-polling.
 */
export function usePairHostCandidates(enabled: boolean) {
  return useQuery({
    queryKey: PAIR_HOST_CANDIDATES_KEY,
    queryFn: () => apiClient.getPairHostCandidates(),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * Mint a fresh pairing token for a chosen host. The result is short-lived
 * (5 min); the dialog should re-mint when expiry is hit.
 */
export function useInitPairing() {
  return useMutation({
    mutationFn: (host: string) => apiClient.initPairing(host),
  });
}

/**
 * Revoke a paired device. Invalidates the device list so the row disappears
 * on success.
 */
export function useRevokePairedDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => apiClient.revokePairedDevice(deviceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PAIRED_DEVICES_KEY });
    },
  });
}
