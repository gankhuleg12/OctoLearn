import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  /** 0–100 */
  percent: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/** Animates to the new value whenever `percent` changes (e.g. after a lesson). */
export function ProgressBar({ percent, color, trackColor, height = 14, style, accessibilityLabel }: Props) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  const width = useSharedValue(clamped);

  useEffect(() => {
    width.set(withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [clamped, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[styles.track, { height, backgroundColor: trackColor ?? t.surfaceStrong }, style]}>
      <Animated.View style={[styles.fill, { backgroundColor: color ?? t.green }, fill]}>
        {/* Glossy highlight strip for a playful look */}
        <View style={styles.shine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: Radius.full, overflow: 'hidden', alignSelf: 'stretch' },
  fill: { height: '100%', borderRadius: Radius.full, minWidth: 0 },
  shine: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
