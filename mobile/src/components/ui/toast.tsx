import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

type ToastKind = 'info' | 'error' | 'locked';

interface ToastState {
  toast: { id: number; message: string; kind: ToastKind } | null;
  show: (message: string, kind?: ToastKind) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show(message, kind = 'info') {
    clearTimeout(timer);
    set({ toast: { id: Date.now(), message, kind } });
    timer = setTimeout(() => set({ toast: null }), 2600);
  },
}));

/** Fire-and-forget toast from anywhere (also outside React). */
export const showToast = (message: string, kind?: ToastKind) => useToastStore.getState().show(message, kind);

const ICONS: Record<ToastKind, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  error: 'alert-circle',
  locked: 'lock-closed',
};

/** Mounted once in the root layout. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const t = useTheme();
  if (!toast) return null;

  const bg = toast.kind === 'error' ? t.red : t.text;
  const fg = toast.kind === 'error' ? '#fff' : t.background;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + Spacing.sm }]}>
      <Animated.View
        key={toast.id}
        entering={FadeInUp.springify()}
        exiting={FadeOutUp}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: bg }]}>
        <Ionicons name={ICONS[toast.kind]} size={20} color={fg} />
        <Text variant="bodyBold" style={{ color: fg, flexShrink: 1 }}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    maxWidth: 480,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
