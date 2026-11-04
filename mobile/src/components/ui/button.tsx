import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Fonts, Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

type Variant = 'primary' | 'success' | 'danger' | 'secondary' | 'ghost';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
}

const DEPTH = 4;

/** Chunky "3D" button: a darker base below the face; pressing sinks the face. */
export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, accessibilityHint }: ButtonProps) {
  const t = useTheme();
  const palette: Record<Variant, { face: string; base: string; text: string; border?: string }> = {
    primary: { face: t.purple, base: t.purpleDark, text: t.onPrimary },
    success: { face: t.green, base: t.greenDark, text: t.onPrimary },
    danger: { face: t.red, base: t.redDark, text: t.onPrimary },
    secondary: { face: t.background, base: t.border, text: t.text, border: t.border },
    ghost: { face: 'transparent', base: 'transparent', text: t.purple },
  };
  const isDisabled = disabled || loading;
  const c = isDisabled && variant !== 'ghost' ? { face: t.locked, base: t.lockedDark, text: t.textSecondary } : palette[variant];
  const flat = variant === 'ghost';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={[styles.wrap, style]}>
      {({ pressed }) => (
        <View style={[styles.base, { backgroundColor: c.base, paddingBottom: flat ? 0 : DEPTH }]}>
          <View
            style={[
              styles.face,
              {
                backgroundColor: c.face,
                borderColor: 'border' in c && c.border ? c.border : c.face,
                transform: [{ translateY: pressed && !flat ? DEPTH : 0 }],
              },
              flat && pressed && { opacity: 0.6 },
            ]}>
            {loading ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <>
                {icon}
                <Text style={[styles.label, { color: c.text }]}>{title}</Text>
              </>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  base: { borderRadius: Radius.md },
  face: {
    minHeight: TouchTarget,
    borderRadius: Radius.md,
    borderWidth: 2,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontFamily: Fonts.extrabold, fontSize: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
});
