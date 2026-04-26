import { Mic, Sparkles, User2, Users, Volume2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type VoiceProfileResponse } from '@/lib/api';
import { colors } from '@/lib/colors';
import { useProfiles } from '@/lib/hooks';

export default function VoicesTab() {
  const profiles = useProfiles();
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = profiles.data ?? [];
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.language.toLowerCase().includes(q),
    );
  }, [profiles.data, query]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-6 py-3 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground text-2xl font-bold tracking-tight">Voices</Text>
          {profiles.data ? (
            <Text className="text-muted-foreground text-xs">
              {profiles.data.length} {profiles.data.length === 1 ? 'voice' : 'voices'}
            </Text>
          ) : null}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search voices…"
          placeholderTextColor={colors.mutedForeground}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-foreground"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        refreshControl={
          <RefreshControl
            refreshing={profiles.isRefetching && !profiles.isLoading}
            onRefresh={() => profiles.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          profiles.isLoading ? (
            <View className="pt-12 items-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : query ? (
            <Text className="text-muted-foreground text-sm pt-6 text-center">
              No voices match "{query}".
            </Text>
          ) : (
            <EmptyState />
          )
        }
        renderItem={({ item }) => (
          <ProfileRow
            profile={item}
            expanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function ProfileRow({
  profile,
  expanded,
  onPress,
}: {
  profile: VoiceProfileResponse;
  expanded: boolean;
  onPress: () => void;
}) {
  const kindIcon =
    profile.voice_type === 'preset' ? Sparkles : profile.voice_type === 'designed' ? User2 : Mic;
  const KindIcon = kindIcon;

  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border px-4 py-3 ${
        expanded ? 'border-accent/40 bg-accent/5' : 'border-border bg-card'
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`h-11 w-11 rounded-full items-center justify-center ${
            profile.voice_type === 'preset' ? 'bg-accent/15' : 'bg-muted'
          }`}
        >
          <Volume2 size={18} color={profile.voice_type === 'preset' ? colors.accent : colors.mutedForeground} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
            {profile.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-muted-foreground text-[11px] uppercase tracking-wider">
              {profile.language}
            </Text>
            <KindBadge kind={profile.voice_type} />
            <Text className="text-muted-foreground text-[11px]">
              {profile.generation_count} gens
              {profile.voice_type === 'cloned' ? `  ·  ${profile.sample_count} samples` : ''}
            </Text>
          </View>
        </View>
        <KindIcon size={16} color={colors.mutedForeground} />
      </View>
      {expanded && profile.description ? (
        <View className="mt-3 pt-3 border-t border-border/60">
          <Text className="text-muted-foreground text-sm leading-snug">
            {profile.description}
          </Text>
          {profile.default_engine ? (
            <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mt-2">
              engine · {profile.default_engine}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function KindBadge({ kind }: { kind: VoiceProfileResponse['voice_type'] }) {
  const label =
    kind === 'preset' ? 'PRESET' : kind === 'designed' ? 'DESIGNED' : 'CLONED';
  return (
    <View className="px-1.5 py-0.5 rounded-sm bg-muted">
      <Text className="text-muted-foreground text-[9px] font-semibold tracking-widest">
        {label}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center pt-16 px-6 gap-3">
      <View className="h-14 w-14 rounded-full bg-accent/10 items-center justify-center">
        <Users size={22} color={colors.accent} />
      </View>
      <Text className="text-foreground text-base font-semibold">No voices yet</Text>
      <Text className="text-muted-foreground text-sm text-center max-w-[260px]">
        Create voice profiles in your Voicebox desktop — they'll appear here automatically.
      </Text>
    </View>
  );
}
