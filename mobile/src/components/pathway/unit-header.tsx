import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { Unit } from '@/api/types';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const UNIT_COLORS = [
  { face: '#7C5CFF', base: '#5B3FD9' },
  { face: '#22C55E', base: '#16A34A' },
  { face: '#FF7A1A', base: '#D9600A' },
  { face: '#0EA5E9', base: '#0284C7' },
] as const;

export function unitColor(index: number) {
  return UNIT_COLORS[index % UNIT_COLORS.length]!;
}

export function UnitHeader({ unit, index }: { unit: Unit; index: number }) {
  const t = useTheme();
  const locked = unit.state === 'locked';
  const color = locked ? { face: t.locked, base: t.lockedDark } : unitColor(index);
  const fg = locked ? t.textSecondary : '#fff';

  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={`${unit.title}${locked ? ', түгжээтэй' : unit.state === 'completed' ? ', дууссан' : ''}`}
      style={[styles.base, { backgroundColor: color.base }]}>
      <View style={[styles.face, { backgroundColor: color.face }]}>
        <View style={styles.texts}>
          <Text variant="label" style={{ color: fg, opacity: 0.85 }}>
            Бүлэг {index + 1}
          </Text>
          <Text variant="heading" style={{ color: fg }}>
            {unit.title.replace(/^Бүлэг\s*\d+\s*:\s*/, '')}
          </Text>
          {unit.description ? (
            <Text variant="caption" style={{ color: fg, opacity: 0.9 }} numberOfLines={2}>
              {unit.description}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={locked ? 'lock-closed' : unit.state === 'completed' ? 'checkmark-circle' : 'book'}
          size={30}
          color={fg}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.lg, paddingBottom: 4, alignSelf: 'stretch' },
  face: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  texts: { flex: 1, gap: 2 },
});
