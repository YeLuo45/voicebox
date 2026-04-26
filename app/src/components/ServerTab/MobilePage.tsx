import { Lock, MoreHorizontal, Plus, Smartphone, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  usePairedDevices,
  useRevokePairedDevice,
} from '@/lib/hooks/usePairedDevices';
import type { PairedDeviceResponse } from '@/lib/api/types';
import { PairDeviceDialog } from './PairDeviceDialog';
import { SettingRow, SettingSection } from './SettingRow';

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function MobilePage() {
  const [pairOpen, setPairOpen] = useState(false);
  const devices = usePairedDevices();
  const revoke = useRevokePairedDevice();
  const { toast } = useToast();

  const active = (devices.data ?? []).filter((d) => !d.revoked);
  const revoked = (devices.data ?? []).filter((d) => d.revoked);

  function handleRevoke(d: PairedDeviceResponse) {
    revoke.mutate(d.id, {
      onSuccess: () => {
        toast({
          title: 'Device revoked',
          description: `${d.name} can no longer reach this Voicebox.`,
        });
      },
      onError: (e) => {
        toast({
          title: 'Revoke failed',
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        });
      },
    });
  }

  return (
    <div className="flex gap-8 items-start max-w-5xl">
      <div className="flex-1 min-w-0 max-w-2xl space-y-10">
        <SettingSection
          title="Mobile"
          description="Pair your phone to dictate, browse captures, and generate from anywhere on your network."
        >
          <SettingRow
            title="Paired devices"
            description={
              active.length === 0
                ? 'No devices yet — pair your phone to get started.'
                : `${active.length} active${revoked.length > 0 ? `, ${revoked.length} revoked` : ''}`
            }
            action={
              <Button onClick={() => setPairOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Pair device
              </Button>
            }
          />

          {devices.data && devices.data.length > 0 ? (
            <div className="pt-3 space-y-2">
              {[...active, ...revoked].map((d) => (
                <DeviceRow
                  key={d.id}
                  device={d}
                  onRevoke={() => handleRevoke(d)}
                  revoking={revoke.isPending && revoke.variables === d.id}
                />
              ))}
            </div>
          ) : devices.isLoading ? (
            <div className="pt-3 text-sm text-muted-foreground">Loading devices…</div>
          ) : (
            <EmptyState onPair={() => setPairOpen(true)} />
          )}
        </SettingSection>
      </div>

      <aside className="hidden lg:block w-[280px] shrink-0 space-y-6 sticky top-0">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">About pairing</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pairing creates a long-lived bearer that only your phone holds.
            Voicebox stores just a hash — there's no path to recover the
            bearer if the device loses it.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">How it works</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2.5">
              <Smartphone className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">Local-first.</span>{' '}
                Your phone talks to this Voicebox over LAN or Tailscale — no cloud,
                no relay.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">Bearer-only.</span>{' '}
                The bearer is shown to the device once at pairing time and
                never persisted server-side in plaintext.
              </span>
            </li>
            <li className="flex gap-2.5">
              <WifiOff className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
              <span className="leading-relaxed">
                <span className="text-foreground font-medium">Revocable.</span>{' '}
                Revoke any device here — its bearer stops working immediately.
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <PairDeviceDialog open={pairOpen} onOpenChange={setPairOpen} />
    </div>
  );
}

function DeviceRow({
  device,
  onRevoke,
  revoking,
}: {
  device: PairedDeviceResponse;
  onRevoke: () => void;
  revoking: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
        device.revoked ? 'border-border/50 bg-muted/20 opacity-60' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            device.revoked ? 'bg-muted' : 'bg-accent/15'
          }`}
        >
          <Smartphone
            className={`h-4 w-4 ${device.revoked ? 'text-muted-foreground' : 'text-accent'}`}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {device.name}
            {device.revoked ? (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                revoked
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            Last seen {formatRelative(device.last_seen_at)} · paired{' '}
            {formatRelative(device.created_at)}
          </div>
        </div>
      </div>
      {!device.revoked ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={revoking}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRevoke} className="text-destructive">
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function EmptyState({ onPair }: { onPair: () => void }) {
  return (
    <div className="pt-6 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <Smartphone className="h-5 w-5 text-accent" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">No paired devices</p>
        <p className="text-xs text-muted-foreground max-w-[280px]">
          Pair your phone to dictate captures, queue generations, and play back voices on the go.
        </p>
      </div>
      <Button onClick={onPair} size="sm" className="mt-2 gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Pair device
      </Button>
    </div>
  );
}
