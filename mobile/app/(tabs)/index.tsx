import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import { LogOut, Mic, Pause, Play, Square, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveWaveform } from '@/components/ui/LiveWaveform';
import {
  authHeaders,
  buildCaptureAudioUrl,
  deleteCapture,
  type CaptureResponse,
} from '@/lib/api';
import { colors } from '@/lib/colors';
import { useDictation, type DictationPhase } from '@/lib/dictation';
import { useCaptures, useInvalidateCaptures } from '@/lib/hooks';
import { useSession } from '@/lib/session';

function formatRelative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function pillCopyFor(phase: DictationPhase, durationSec: number): string {
  if (phase === 'recording') {
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    return `Recording  ${m}:${s.toString().padStart(2, '0')}`;
  }
  if (phase === 'processing') return 'Transcribing…';
  if (phase === 'error') return 'Error';
  return '';
}

export default function CapturesTab() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const clearSession = useSession((s) => s.clear);
  const captures = useCaptures();
  const invalidateCaptures = useInvalidateCaptures();
  const dictation = useDictation();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Single shared player instance for whichever capture is currently expanded.
  const playerSource = useMemo(() => {
    if (!session || !expandedId) return null;
    return {
      uri: buildCaptureAudioUrl(session, expandedId),
      headers: authHeaders(session),
    };
  }, [session, expandedId]);
  const player = useAudioPlayer(playerSource ?? null);
  const status = useAudioPlayerStatus(player);

  // Pulse the mic button while recording.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (dictation.phase !== 'recording') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dictation.phase, pulse]);

  async function handleMicPress() {
    if (dictation.phase === 'recording') {
      const result = await dictation.stop();
      if (result) invalidateCaptures();
      return;
    }
    if (dictation.phase === 'processing') return;
    void dictation.start();
  }

  async function handleSignOut() {
    await clearSession();
    router.replace('/welcome');
  }

  function toggleExpanded(captureId: string) {
    if (expandedId === captureId) {
      setExpandedId(null);
    } else {
      setExpandedId(captureId);
    }
  }

  async function handleDelete(capture: CaptureResponse) {
    if (!session) return;
    if (expandedId === capture.id) setExpandedId(null);
    try {
      await deleteCapture(session, capture.id);
      invalidateCaptures();
    } catch (e) {
      console.warn('Delete failed', e);
    }
  }

  const items = captures.data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-3">
        <Text className="text-foreground text-2xl font-bold tracking-tight">Captures</Text>
        <Pressable
          onPress={handleSignOut}
          hitSlop={12}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          className="h-9 w-9 rounded-full items-center justify-center"
        >
          <LogOut size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* Recording HUD: live waveform + timer while recording. Falls back to a
          compact pill for processing/error so we don't reserve the screen
          space while transcription runs. */}
      {dictation.phase === 'recording' ? (
        <View className="px-6 pb-2 gap-2">
          <View className="rounded-2xl bg-destructive/10 border border-destructive/30 px-4 py-3 gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-destructive" />
                <Text className="text-foreground text-xs font-semibold uppercase tracking-widest">
                  Recording
                </Text>
              </View>
              <Text
                className="text-foreground text-xs font-semibold"
                style={{ fontFamily: 'Menlo' }}
              >
                {`${Math.floor(dictation.durationSec / 60)}:${(dictation.durationSec % 60).toString().padStart(2, '0')}`}
              </Text>
            </View>
            <LiveWaveform active={true} levelDb={dictation.meteringDb} />
          </View>
        </View>
      ) : dictation.phase !== 'idle' ? (
        <View className="px-6 pb-2">
          <View
            className={`self-center flex-row items-center gap-2 px-4 py-1.5 rounded-full ${
              dictation.phase === 'error' ? 'bg-destructive/15' : 'bg-accent/15'
            }`}
          >
            {dictation.phase === 'processing' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
            <Text
              className={`text-xs font-semibold ${
                dictation.phase === 'error' ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {pillCopyFor(dictation.phase, dictation.durationSec)}
            </Text>
          </View>
          {dictation.error ? (
            <Text className="text-destructive text-xs text-center mt-2">{dictation.error}</Text>
          ) : null}
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 180 }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        refreshControl={
          <RefreshControl
            refreshing={captures.isRefetching && !captures.isLoading}
            onRefresh={() => captures.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          captures.isLoading ? (
            <View className="items-center pt-16">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <EmptyState />
          )
        }
        renderItem={({ item }) => (
          <CaptureRow
            capture={item}
            expanded={expandedId === item.id}
            isPlaying={expandedId === item.id && status.playing}
            currentTime={expandedId === item.id ? status.currentTime ?? 0 : 0}
            duration={
              expandedId === item.id
                ? status.duration ?? (item.duration_ms ? item.duration_ms / 1000 : 0)
                : item.duration_ms
                  ? item.duration_ms / 1000
                  : 0
            }
            onPress={() => toggleExpanded(item.id)}
            onPlayPause={() => {
              if (status.playing) player.pause();
              else player.play();
            }}
            onDelete={() => handleDelete(item)}
          />
        )}
      />

      {/* Floating mic */}
      <View pointerEvents="box-none" className="absolute left-0 right-0" style={{ bottom: 24 }}>
        <View className="items-center">
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Pressable
              onPress={handleMicPress}
              accessibilityRole="button"
              accessibilityLabel={
                dictation.phase === 'recording' ? 'Stop recording' : 'Start recording'
              }
              disabled={dictation.phase === 'processing'}
              style={({ pressed }) => ({
                width: 78,
                height: 78,
                borderRadius: 39,
                backgroundColor:
                  dictation.phase === 'recording' ? colors.destructive : colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                shadowColor:
                  dictation.phase === 'recording' ? colors.destructive : colors.accent,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 18,
                elevation: 10,
              })}
            >
              {dictation.phase === 'processing' ? (
                <ActivityIndicator color="#fff" />
              ) : dictation.phase === 'recording' ? (
                <Square size={28} color="#fff" fill="#fff" />
              ) : (
                <Mic size={32} color="#fff" />
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function CaptureRow({
  capture,
  expanded,
  isPlaying,
  currentTime,
  duration,
  onPress,
  onPlayPause,
  onDelete,
}: {
  capture: CaptureResponse;
  expanded: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPress: () => void;
  onPlayPause: () => void;
  onDelete: () => void;
}) {
  const transcript = capture.transcript_refined?.trim() || capture.transcript_raw.trim();
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border px-4 py-3 gap-2 ${
        expanded ? 'border-accent/50 bg-accent/5' : 'border-border bg-card'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
          {formatRelative(capture.created_at)}
          {capture.duration_ms ? `  ·  ${formatDuration(capture.duration_ms)}` : ''}
        </Text>
        {capture.transcript_refined ? (
          <View className="px-1.5 py-0.5 rounded-sm bg-accent/15">
            <Text className="text-accent text-[10px] font-semibold">REFINED</Text>
          </View>
        ) : null}
      </View>
      <Text
        className="text-foreground text-sm leading-snug"
        numberOfLines={expanded ? undefined : 6}
      >
        {transcript || '(empty transcript)'}
      </Text>

      {expanded ? (
        <View className="pt-2 gap-2 border-t border-border/60">
          {/* Progress bar */}
          <View className="h-1.5 rounded-full bg-muted overflow-hidden">
            <View
              className="h-full bg-accent"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-[11px]" style={{ fontFamily: 'Menlo' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                hitSlop={8}
                className="h-8 w-8 rounded-full items-center justify-center"
                accessibilityLabel="Delete capture"
              >
                <Trash2 size={14} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onPlayPause();
                }}
                hitSlop={8}
                className="h-9 w-9 rounded-full items-center justify-center bg-accent"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={16} color="#F2F2F2" fill="#F2F2F2" />
                ) : (
                  <Play size={16} color="#F2F2F2" fill="#F2F2F2" />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View className="items-center pt-20 px-6 gap-3">
      <View className="h-14 w-14 rounded-full bg-accent/10 items-center justify-center">
        <Mic size={22} color={colors.accent} />
      </View>
      <Text className="text-foreground text-base font-semibold">No captures yet</Text>
      <Text className="text-muted-foreground text-sm text-center max-w-[260px]">
        Tap the mic to dictate. Audio and transcript both stay on your desktop — Voicebox keeps every recording.
      </Text>
    </View>
  );
}
