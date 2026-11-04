import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import type { DailyXp } from '@/api/types';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
const BAR_MAX = 96;

/** Last 7 days of XP; today is the right-most bar. */
export function WeeklyChart({ days }: { days: DailyXp[] }) {
  const t = useTheme();
  const max = Math.max(20, ...days.map((d) => d.xp));
  const total = days.reduce((s, d) => s + d.xp, 0);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Сүүлийн 7 хоногт ${total} XP. ${days.map((d) => `${WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()]} ${d.xp}`).join(', ')}`}>
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        const height = d.xp === 0 ? 4 : Math.max(10, Math.round((d.xp / max) * BAR_MAX));
        return (
          <View key={d.date} style={styles.col}>
            <Text variant="caption" color="textSecondary" style={styles.value}>
              {d.xp || ''}
            </Text>
            <Animated.View
              entering={FadeInUp.delay(i * 60)}
              style={[styles.bar, { height, backgroundColor: d.xp ? (isToday ? t.gold : t.purple) : t.surfaceStrong }]}
            />
            <Text variant="caption" color={isToday ? 'text' : 'textSecondary'}>
              {WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, height: BAR_MAX + 48 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  value: { minHeight: 18 },
  bar: { width: '70%', maxWidth: 30, borderRadius: 6 },
});
