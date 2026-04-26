import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { colors } from '@/lib/colors';

const BAR_COUNT = 36;
const MIN_BAR = 0.1;

/**
 * Scrolling-buffer waveform driven by mic metering. Each metering tick
 * pushes a new bar onto the right and drops the oldest from the left, so
 * the waveform reads as a 36-bar sliding window of the last few seconds
 * of audio. Pure React Native — no Skia, no native modules.
 *
 * ``levelDb`` should be the value out of ``RecorderState.metering`` (a
 * dB-scale instantaneous level, typically -160 to 0).
 */
export function LiveWaveform({
  active,
  levelDb,
}: {
  active: boolean;
  levelDb: number | undefined;
}) {
  const [buffer, setBuffer] = useState<number[]>(() => Array(BAR_COUNT).fill(MIN_BAR));

  // Push a new bar each time the metering value changes (which happens
  // every poll interval — set to ~80ms in dictation.ts).
  useEffect(() => {
    if (!active) return;
    const norm = normalize(levelDb);
    setBuffer((prev) => [...prev.slice(1), norm]);
  }, [levelDb, active]);

  // Decay back to flat when not recording.
  useEffect(() => {
    if (active) return;
    setBuffer(Array(BAR_COUNT).fill(MIN_BAR));
  }, [active]);

  return (
    <View
      className="flex-row items-center justify-center"
      style={{ height: 48, gap: 3 }}
    >
      {buffer.map((h, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: `${Math.round(h * 100)}%`,
            backgroundColor: active ? colors.destructive : colors.mutedForeground,
            borderRadius: 1.5,
            opacity: active ? 0.85 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Map dB (-160 → 0) to display height (0.1 → 1.0).
 *
 * Speech typically lives in the -40 dB → -10 dB range; we compress that
 * into the visible part of the bar so quiet speech still moves the bars
 * visibly. Returns MIN_BAR for null/undefined so a missing metering field
 * just shows a flat baseline rather than breaking the waveform.
 */
function normalize(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return MIN_BAR;
  // Clamp to a useful range and normalize.
  const clamped = Math.max(-60, Math.min(0, db));
  // Linear in dB (close enough — psychoacoustic-correct curves are V2).
  const linear = (clamped + 60) / 60;
  // Power curve to favor mid-range — keeps the bars feeling responsive.
  const shaped = Math.pow(linear, 1.6);
  return Math.max(MIN_BAR, Math.min(1, shaped));
}
