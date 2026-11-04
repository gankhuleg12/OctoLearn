import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/endpoints';
import type { Leaderboard, LeaderboardEntry } from '@/api/types';
import { Avatar } from '@/components/ui/avatar';
import { ErrorView, LoadingView, MessageView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MEDALS = ['🥇', '🥈', '🥉'];

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[styles.row, { borderColor: isMe ? t.purple : t.border, backgroundColor: isMe ? t.primarySoft : t.background }]}
      accessible
      accessibilityLabel={`${entry.rank}-р байр, ${entry.name}${isMe ? ' (та)' : ''}, ${entry.totalXp} XP`}>
      <View style={styles.rank}>
        {entry.rank <= 3 ? (
          <Text style={styles.medal}>{MEDALS[entry.rank - 1]}</Text>
        ) : (
          <Text style={[styles.rankText, { color: t.textSecondary }]}>{entry.rank}</Text>
        )}
      </View>
      <Avatar name={entry.name} url={entry.avatarUrl} size={40} />
      <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
        {entry.name}
        {isMe ? ' (та)' : ''}
      </Text>
      <Text variant="bodyBold" style={{ color: t.goldDark }}>
        ⚡ {entry.totalXp}
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const t = useTheme();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.leaderboard(50));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        {error ? <ErrorView message={error} onRetry={load} /> : <LoadingView />}
      </SafeAreaView>
    );
  }

  const me = data.me;
  const meInList = me && data.entries.some((e) => e.userId === me.userId);

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: t.background }]}>
      <FlatList
        data={data.entries}
        keyExtractor={(e) => e.userId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.trophy}>🏆</Text>
            <Text variant="title" center>
              XP чансаа
            </Text>
            <Text color="textSecondary" center>
              Хичээл үзэж, шалгалт өгөөд дээш ахиарай!
            </Text>
          </View>
        }
        ListEmptyComponent={<MessageView icon="people-outline" title="Одоогоор хэн ч алга" message="Эхний XP-гээ цуглуулаад тэргүүлээрэй!" />}
        renderItem={({ item }) => <Row entry={item} isMe={item.userId === me?.userId} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={t.purple}
            colors={[t.purple]}
          />
        }
      />
      {me && !meInList && (
        <View style={[styles.meBar, { borderTopColor: t.border, backgroundColor: t.background }]}>
          <View style={styles.inner}>
            <Row entry={me} isMe />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: Spacing.lg, paddingBottom: Spacing.xxl, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  trophy: { fontSize: 56, lineHeight: 68 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 2,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 60,
  },
  rank: { width: 32, alignItems: 'center' },
  medal: { fontSize: 26 },
  rankText: { fontFamily: Fonts.black, fontSize: 18 },
  meBar: { borderTopWidth: 2, padding: Spacing.md },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
