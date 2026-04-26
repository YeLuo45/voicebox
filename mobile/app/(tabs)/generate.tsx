import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Loader2, Pause, Play, Sparkles, Volume2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import {
  authHeaders,
  buildGenerationAudioUrl,
  type HistoryResponse,
  type VoiceProfileResponse,
} from '@/lib/api';
import { colors } from '@/lib/colors';
import { useGenerate, useGenerationPolling, useHistory, useProfiles } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function GenerateTab() {
  const session = useSession((s) => s.session);
  const profiles = useProfiles();
  const history = useHistory(20);
  const generateMutation = useGenerate();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);

  const polling = useGenerationPolling(pendingId);
  const playingSource = useMemo(() => {
    if (!session || !nowPlayingId) return null;
    return {
      uri: buildGenerationAudioUrl(session, nowPlayingId),
      headers: authHeaders(session),
    };
  }, [session, nowPlayingId]);
  const player = useAudioPlayer(playingSource ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  // Default-select first profile when the list arrives.
  useEffect(() => {
    if (selectedProfileId === null && profiles.data && profiles.data.length > 0) {
      setSelectedProfileId(profiles.data[0].id);
    }
  }, [profiles.data, selectedProfileId]);

  // When the polled generation completes, auto-play it and clear pending.
  useEffect(() => {
    const data = polling.data;
    if (!data) return;
    if (data.status === 'completed') {
      setNowPlayingId(data.id);
      setPendingId(null);
    } else if (data.status === 'failed') {
      setPendingId(null);
    }
  }, [polling.data]);

  // Auto-play when a new source comes in.
  useEffect(() => {
    if (!playingSource) return;
    const t = window.setTimeout(() => {
      try {
        player.play();
      } catch {
        // ignore — player may not be ready yet
      }
    }, 100);
    return () => window.clearTimeout(t);
  }, [playingSource, player]);

  const selectedProfile = profiles.data?.find((p) => p.id === selectedProfileId) ?? null;
  const isGenerating =
    generateMutation.isPending ||
    (pendingId !== null && polling.data?.status !== 'completed');

  function handleGenerate() {
    if (!selectedProfile || !text.trim() || isGenerating) return;
    generateMutation.mutate(
      {
        profile_id: selectedProfile.id,
        text: text.trim(),
        language: selectedProfile.language,
        engine: selectedProfile.default_engine ?? undefined,
      },
      {
        onSuccess: (gen) => {
          setPendingId(gen.id);
          setText('');
        },
      },
    );
  }

  function handlePlayHistory(item: HistoryResponse) {
    if (item.status !== 'completed') return;
    if (nowPlayingId === item.id) {
      // Toggle play/pause
      if (playerStatus.playing) player.pause();
      else player.play();
      return;
    }
    setNowPlayingId(item.id);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-6 py-3">
        <Text className="text-foreground text-2xl font-bold tracking-tight">Generate</Text>
      </View>

      {/* Profile picker */}
      <View className="pb-3">
        {profiles.isLoading ? (
          <View className="px-6 h-24 justify-center">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : profiles.data && profiles.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
          >
            {profiles.data.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={p.id === selectedProfileId}
                onPress={() => setSelectedProfileId(p.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <View className="px-6 py-4">
            <Text className="text-muted-foreground text-sm">
              No profiles found on this desktop. Create one in Voicebox first.
            </Text>
          </View>
        )}
      </View>

      {/* Text input */}
      <View className="px-6 pb-3">
        <View className="rounded-2xl border border-border bg-card p-4 gap-3">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={
              selectedProfile
                ? `Speak as ${selectedProfile.name}…`
                : 'Pick a voice above'
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={!!selectedProfile && !isGenerating}
            className="text-foreground text-base min-h-[80px]"
            style={{ textAlignVertical: 'top' }}
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-xs">
              {text.length > 0 ? `${text.length} chars` : ' '}
            </Text>
            <Button
              label={isGenerating ? 'Generating' : 'Speak'}
              size="sm"
              loading={isGenerating}
              disabled={!selectedProfile || !text.trim() || isGenerating}
              onPress={handleGenerate}
              leftSlot={
                isGenerating ? null : <Sparkles size={14} color="#F2F2F2" />
              }
            />
          </View>
          {generateMutation.isError ? (
            <Text className="text-destructive text-xs">
              {(generateMutation.error as Error)?.message ?? 'Generate failed'}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Recent generations */}
      <View className="px-6 pt-2 pb-1">
        <Text className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent
        </Text>
      </View>
      <FlatList
        data={history.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isLoading}
            onRefresh={() => history.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          history.isLoading ? (
            <View className="pt-6 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <Text className="text-muted-foreground text-sm pt-4">
              Nothing yet — your generations will appear here.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <HistoryRow
            item={item}
            isActive={nowPlayingId === item.id}
            isPlaying={nowPlayingId === item.id && playerStatus.playing}
            onPress={() => handlePlayHistory(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ProfileCard({
  profile,
  selected,
  onPress,
}: {
  profile: VoiceProfileResponse;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`w-[140px] rounded-2xl px-4 py-3 border ${
        selected ? 'border-accent bg-accent/10' : 'border-border bg-card'
      }`}
      accessibilityRole="button"
      accessibilityLabel={`Voice ${profile.name}`}
      accessibilityState={{ selected }}
    >
      <View
        className={`h-9 w-9 rounded-full mb-2 items-center justify-center ${
          selected ? 'bg-accent' : 'bg-muted'
        }`}
      >
        <Volume2 size={16} color={selected ? '#F2F2F2' : colors.mutedForeground} />
      </View>
      <Text
        className="text-foreground text-sm font-semibold"
        numberOfLines={1}
      >
        {profile.name}
      </Text>
      <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
        {profile.language.toUpperCase()}
        {profile.voice_type === 'preset' ? '  ·  preset' : ''}
      </Text>
    </Pressable>
  );
}

function HistoryRow({
  item,
  isActive,
  isPlaying,
  onPress,
}: {
  item: HistoryResponse;
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
}) {
  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isPending = !isCompleted && !isFailed;
  return (
    <Pressable
      onPress={onPress}
      disabled={!isCompleted}
      className={`flex-row items-center gap-3 rounded-xl px-3 py-3 border ${
        isActive
          ? 'border-accent/50 bg-accent/10'
          : 'border-border bg-card'
      } ${!isCompleted ? 'opacity-70' : ''}`}
    >
      <View
        className={`h-10 w-10 rounded-full items-center justify-center ${
          isActive ? 'bg-accent' : 'bg-muted'
        }`}
      >
        {isPending ? (
          <Loader2 size={16} color={colors.mutedForeground} />
        ) : isPlaying ? (
          <Pause size={16} color="#F2F2F2" fill="#F2F2F2" />
        ) : (
          <Play size={16} color={isActive ? '#F2F2F2' : colors.mutedForeground} fill={isActive ? '#F2F2F2' : 'transparent'} />
        )}
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-foreground text-sm" numberOfLines={2}>
          {item.text}
        </Text>
        <Text className="text-muted-foreground text-[11px] mt-0.5">
          {item.profile_name}
          {item.duration ? `  ·  ${item.duration.toFixed(1)}s` : ''}
          {isFailed ? '  ·  failed' : ''}
          {isPending ? '  ·  generating…' : ''}
        </Text>
      </View>
    </Pressable>
  );
}
