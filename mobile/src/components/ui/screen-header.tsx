import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Close (✕) button on the left, free content in the middle — used by lesson & quiz. */
export function ScreenHeader({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Хаах"
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}>
        <Ionicons name="close" size={30} color={t.textSecondary} />
      </Pressable>
      <View style={styles.middle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, minHeight: 56 },
  close: { width: TouchTarget, height: TouchTarget, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, paddingRight: Spacing.lg },
});
