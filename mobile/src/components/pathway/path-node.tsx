import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { NodeState } from '@/api/types';
import { Text } from '@/components/ui/text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LESSON_SIZE = 72;
const QUIZ_SIZE = 84;
const DEPTH = 6;

interface Props {
  kind: 'lesson' | 'quiz';
  state: NodeState;
  color: { face: string; base: string };
  accessibilityLabel: string;
  onPress: () => void;
}

/** A bouncing "ЭХЛЭХ" bubble above the active node. */
function StartBubble({ color }: { color: string }) {
  const t = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withRepeat(withSequence(withTiming(-5, { duration: 600 }), withTiming(0, { duration: 600 })), -1, true));
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={[styles.bubble, { backgroundColor: t.background, borderColor: t.border }, style]} pointerEvents="none">
      <Text style={[styles.bubbleText, { color }]}>ЭХЛЭХ</Text>
      <View style={[styles.bubbleArrow, { borderTopColor: t.border }]} />
    </Animated.View>
  );
}

function PulseRing({ size, color }: { size: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - p.get()),
    transform: [{ scale: 1 + p.get() * 0.45 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

export function PathNode({ kind, state, color, accessibilityLabel, onPress }: Props) {
  const t = useTheme();
  const size = kind === 'quiz' ? QUIZ_SIZE : LESSON_SIZE;
  const radius = kind === 'quiz' ? 26 : size / 2;

  const palette =
    state === 'locked'
      ? { face: t.locked, base: t.lockedDark, icon: t.textSecondary }
      : state === 'completed'
        ? { face: t.gold, base: t.goldDark, icon: '#fff' }
        : { face: color.face, base: color.base, icon: '#fff' };

  const icon: keyof typeof Ionicons.glyphMap =
    state === 'locked' ? 'lock-closed' : kind === 'quiz' ? 'trophy' : state === 'completed' ? 'checkmark' : 'play';

  return (
    <View style={styles.wrap}>
      {state === 'active' && <StartBubble color={color.face} />}
      {state === 'active' && <PulseRing size={size + 10} color={color.face} />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: state === 'locked' }}
        hitSlop={8}>
        {({ pressed }) => (
          <View style={{ width: size, height: size + DEPTH, borderRadius: radius, backgroundColor: palette.base }}>
            <View
              style={[
                styles.face,
                {
                  width: size,
                  height: size,
                  borderRadius: radius,
                  backgroundColor: palette.face,
                  transform: [{ translateY: pressed ? DEPTH : 0 }],
                },
              ]}>
              <Ionicons name={icon} size={kind === 'quiz' ? 38 : 32} color={palette.icon} />
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  face: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -1 },
  bubble: {
    position: 'absolute',
    top: -44,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    zIndex: 2,
  },
  bubbleText: { fontFamily: Fonts.black, fontSize: 14, letterSpacing: 0.8 },
  bubbleArrow: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
