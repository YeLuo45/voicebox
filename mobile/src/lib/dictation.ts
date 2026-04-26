import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useState } from 'react';
import { uploadCapture, type CaptureCreateResponse } from './api';
import { useSession } from './session';

export type DictationPhase = 'idle' | 'recording' | 'processing' | 'error';

export type DictationFlow = {
  phase: DictationPhase;
  durationSec: number;
  /** Instantaneous mic level in dB (typically -160 → 0). undefined when not recording or metering disabled. */
  meteringDb: number | undefined;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<CaptureCreateResponse | null>;
  isBusy: boolean;
};

// HIGH_QUALITY + metering enabled so the screen can render a live waveform
// while recording. Metering is per-poll-interval, so we ask for ~80ms ticks.
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};
const RECORDER_POLL_INTERVAL_MS = 80;

/**
 * Wraps expo-audio's recorder + the /captures upload into a single
 * lifecycle: tap-to-start → tap-to-stop → upload → transcribed capture.
 *
 * Synchronous from the caller's POV: ``stop()`` resolves with the new
 * capture (transcript and all) or null on failure.
 */
export function useDictation(): DictationFlow {
  const session = useSession((s) => s.session);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recState = useAudioRecorderState(recorder, RECORDER_POLL_INTERVAL_MS);
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!session) {
      setError('Not paired');
      setPhase('error');
      return;
    }
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission denied');
        setPhase('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, [recorder, session]);

  const stop = useCallback(async (): Promise<CaptureCreateResponse | null> => {
    if (!session) return null;
    setPhase('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('No audio captured');
      const result = await uploadCapture(session, uri, {
        filename: `dictation-${Date.now()}.m4a`,
        mimeType: 'audio/m4a',
        source: 'dictation',
      });
      setPhase('idle');
      return result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Upload failed — is the desktop reachable?',
      );
      setPhase('error');
      return null;
    }
  }, [recorder, session]);

  return {
    phase,
    durationSec: Math.floor((recState.durationMillis ?? 0) / 1000),
    meteringDb: recState.metering,
    error,
    start,
    stop,
    isBusy: phase === 'processing',
  };
}
