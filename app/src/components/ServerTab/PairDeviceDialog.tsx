import { Check, Copy, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  PAIRED_DEVICES_KEY,
  useInitPairing,
  usePairedDevices,
  usePairHostCandidates,
} from '@/lib/hooks/usePairedDevices';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PairDeviceDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const candidates = usePairHostCandidates(open);
  const initPairing = useInitPairing();
  const devices = usePairedDevices({ polling: open });

  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // The IDs that existed when the dialog opened — anything new is a fresh
  // pairing we should celebrate.
  const [baselineDeviceIds, setBaselineDeviceIds] = useState<Set<string> | null>(null);

  // On open: snapshot baseline devices, default-select the first non-loopback
  // candidate, and mint the first token.
  useEffect(() => {
    if (!open) {
      setBaselineDeviceIds(null);
      setSelectedHost(null);
      initPairing.reset();
      return;
    }
    if (devices.data && baselineDeviceIds === null) {
      setBaselineDeviceIds(new Set(devices.data.map((d) => d.id)));
    }
    if (candidates.data && candidates.data.length > 0 && selectedHost === null) {
      const preferred =
        candidates.data.find((c) => c.kind !== 'loopback') ?? candidates.data[0];
      setSelectedHost(preferred.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidates.data, devices.data]);

  // Re-mint the token whenever the host selection changes (the URL embeds
  // the host, so a new selection means a new QR).
  useEffect(() => {
    if (!open || !selectedHost) return;
    initPairing.mutate(selectedHost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedHost]);

  // Wall-clock tick for the countdown.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Detect a freshly paired device and close + toast.
  useEffect(() => {
    if (!open || !devices.data || baselineDeviceIds === null) return;
    const newDevice = devices.data.find(
      (d) => !baselineDeviceIds.has(d.id) && !d.revoked,
    );
    if (newDevice) {
      toast({
        title: 'Device paired',
        description: `${newDevice.name} is now connected.`,
      });
      qc.invalidateQueries({ queryKey: PAIRED_DEVICES_KEY });
      onOpenChange(false);
    }
  }, [open, devices.data, baselineDeviceIds, toast, qc, onOpenChange]);

  const pairing = initPairing.data;
  const expiresAtMs = pairing ? new Date(pairing.expires_at).getTime() : 0;
  const remainingMs = expiresAtMs - now;
  const expired = pairing != null && remainingMs <= 0;

  const qrValue = useMemo(() => pairing?.pairing_url ?? '', [pairing]);

  async function handleCopy() {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.pairing_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast({
        title: 'Copy failed',
        description: e instanceof Error ? e.message : 'Could not access clipboard',
        variant: 'destructive',
      });
    }
  }

  function handleRegenerate() {
    if (!selectedHost) return;
    initPairing.mutate(selectedHost);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-accent" />
            Pair a new device
          </DialogTitle>
          <DialogDescription>
            Open Voicebox on your phone, tap <span className="text-foreground">Get started → Pair</span>,
            then point its camera at this QR.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Host picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Reachable at
            </label>
            <Select
              value={selectedHost ?? ''}
              onValueChange={(v) => setSelectedHost(v)}
              disabled={!candidates.data || candidates.data.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={candidates.isError ? 'Could not load' : 'Detecting addresses…'}
                />
              </SelectTrigger>
              <SelectContent>
                {candidates.data?.map((c) => (
                  <SelectItem key={c.address} value={c.address}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs">{c.address}</span>
                      <span className="text-xs text-muted-foreground">— {c.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.isError ? (
              <p className="text-xs text-destructive leading-snug">
                {(candidates.error as Error)?.message ??
                  'Failed to fetch /pair/host-candidates — is the backend up to date?'}
              </p>
            ) : null}
          </div>

          {/* QR */}
          <div className="flex items-center justify-center rounded-xl border border-border bg-white p-6 min-h-[260px]">
            {initPairing.isPending && !pairing ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : initPairing.isError ? (
              <p className="text-sm text-destructive text-center">
                {(initPairing.error as Error)?.message ?? 'Failed to mint token'}
              </p>
            ) : qrValue ? (
              <QRCode value={qrValue} size={220} />
            ) : (
              <p className="text-sm text-muted-foreground">No host selected</p>
            )}
          </div>

          {/* Countdown + regenerate */}
          {pairing ? (
            <div className="flex items-center justify-between text-xs">
              <span className={expired ? 'text-destructive' : 'text-muted-foreground'}>
                {expired
                  ? 'QR expired — regenerate to continue'
                  : `Expires in ${formatRemaining(remainingMs)}`}
              </span>
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                {expired ? 'Regenerate' : 'New QR'}
              </button>
            </div>
          ) : null}

          {/* Copyable URL */}
          {pairing ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Or paste this URL on the phone
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <code className="flex-1 truncate text-xs font-mono">{pairing.pairing_url}</code>
                <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2">
                  {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-muted-foreground leading-snug">
            The token is single-use and expires in 5 minutes. Once paired, your phone holds a
            long-lived bearer that only it knows — Voicebox stores just a hash. Revoke any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
