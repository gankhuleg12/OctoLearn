import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

interface Option<T extends string> {
  value: T;
  label: string;
  icon: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { backgroundColor: t.surfaceStrong }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (selected) return;
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={[
              styles.option,
              selected && [styles.selected, { backgroundColor: t.background, borderColor: t.purple }],
            ]}>
            <Text style={styles.icon}>{o.icon}</Text>
            <Text variant="caption" style={{ color: selected ? t.purple : t.textSecondary, fontWeight: '700' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.lg, padding: 4, gap: 4 },
  option: {
    flex: 1,
    minHeight: TouchTarget + 8,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  icon: { fontSize: 18, lineHeight: 22 },
});
