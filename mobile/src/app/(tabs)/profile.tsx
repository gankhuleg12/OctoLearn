import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeeklyChart } from '@/components/profile/weekly-chart';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ErrorView, LoadingView } from '@/components/ui/state-views';
import { Text } from '@/components/ui/text';
import { showToast } from '@/components/ui/toast';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth';
import { useLearning } from '@/store/learning';
import { useSettings, type ThemeMode } from '@/store/settings';

const THEME_OPTIONS = [
  { value: 'light', label: 'Цайвар', icon: '☀️' },
  { value: 'dark', label: 'Бараан', icon: '🌙' },
  { value: 'system', label: 'Систем', icon: '📱' },
] as const satisfies readonly { value: ThemeMode; label: string; icon: string }[];

function StatTile({ icon, value, label, color }: { icon: string; value: string | number; label: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { borderColor: t.border }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="heading" style={color ? { color } : undefined}>
          {value}
        </Text>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const t = useTheme();
  const profile = useLearning((s) => s.profile);
  const loadProfile = useLearning((s) => s.loadProfile);
  const resetProgress = useLearning((s) => s.resetProgress);
  const logout = useAuth((s) => s.logout);
  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);

  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'logout' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      await loadProfile();
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loadProfile]);

  // Stats change after every lesson, so refresh whenever the tab is shown.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onConfirm() {
    if (confirm === 'logout') {
      setConfirm(null);
      return logout();
    }
    setBusy(true);
    try {
      await resetProgress();
      showToast('Ахиц шинээр эхэллээ');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.background }]}>
        {error ? <ErrorView message={error} onRetry={load} /> : <LoadingView />}
      </SafeAreaView>
    );
  }

  const { user, stats: s } = profile;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        }>
        <View style={styles.column}>
          <View style={styles.header}>
            <Avatar name={user.name} url={user.avatarUrl} size={88} />
            <Text variant="title" center>
              {user.name}
            </Text>
            <Text color="textSecondary">{user.email}</Text>
          </View>

          <View style={[styles.levelCard, { backgroundColor: t.primarySoft }]}>
            <View style={styles.levelRow}>
              <View style={[styles.levelBadge, { backgroundColor: t.purple }]}>
                <Text variant="heading" style={{ color: '#fff' }}>
                  {s.level}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="bodyBold">Түвшин {s.level}</Text>
                <ProgressBar
                  percent={(s.levelInfo.xpIntoLevel / s.levelInfo.xpForNextLevel) * 100}
                  color={t.purple}
                  height={12}
                  accessibilityLabel="Дараагийн түвшин хүртэл"
                />
                <Text variant="caption" color="textSecondary">
                  Дараагийн түвшин хүртэл {s.levelInfo.xpForNextLevel - s.levelInfo.xpIntoLevel} XP
                </Text>
              </View>
            </View>
          </View>

          <Text variant="heading">Статистик</Text>
          <View style={styles.grid}>
            <StatTile icon="⚡" value={s.totalXp} label="Нийт XP" color={t.goldDark} />
            <StatTile icon="🔥" value={s.streak} label="Өдрийн streak" color={t.orange} />
            <StatTile icon="📘" value={`${s.completedLessons}/${s.totalLessons}`} label="Дууссан хичээл" />
            <StatTile icon="🏆" value={`${s.passedQuizzes}/${s.totalQuizzes}`} label="Тэнцсэн шалгалт" />
            <StatTile icon="🎯" value={s.averageQuizScore == null ? '—' : `${s.averageQuizScore}%`} label="Шалгалтын дундаж" />
            <StatTile icon="📈" value={`${s.percent}%`} label="Курсын ахиц" color={t.green} />
          </View>

          <Text variant="heading">Долоо хоногийн идэвх</Text>
          <View style={[styles.card, { borderColor: t.border }]}>
            <WeeklyChart days={s.weeklyActivity} />
          </View>

          <Text variant="heading">Харагдах байдал</Text>
          <SegmentedControl
            accessibilityLabel="Өнгөний горим"
            options={THEME_OPTIONS}
            value={themeMode}
            onChange={setThemeMode}
          />

          <View style={styles.actions}>
            <Button title="Ахиц дахин эхлүүлэх" variant="secondary" onPress={() => setConfirm('reset')} />
            <Button title="Гарах" variant="ghost" onPress={() => setConfirm('logout')} />
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirm !== null}
        title={confirm === 'reset' ? 'Ахицаа тэглэх үү?' : 'Гарах уу?'}
        message={
          confirm === 'reset'
            ? 'Бүх хичээл, шалгалтын ахиц болон XP устаж, эхнээс нь эхэлнэ.'
            : 'Дахин нэвтэрч ахицаа үргэлжлүүлэх боломжтой.'
        }
        confirmLabel={confirm === 'reset' ? 'Тэглэх' : 'Гарах'}
        danger={confirm === 'reset'}
        loading={busy}
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl * 2 },
  column: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  header: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  levelCard: { borderRadius: Radius.lg, padding: Spacing.lg },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  levelBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 2,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  tileIcon: { fontSize: 26 },
  card: { borderWidth: 2, borderRadius: Radius.lg, padding: Spacing.lg },
  actions: { gap: Spacing.md, marginTop: Spacing.md },
});
