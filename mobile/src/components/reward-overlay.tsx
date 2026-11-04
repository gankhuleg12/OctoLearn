import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, BounceIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  emoji: string;
  title: string;
  xp: number;
  subtitle?: string;
  actionLabel?: string;
  onContinue: () => void;
}

const SPARKS = ['✨', '⭐', '🎉', '✨', '⭐'];

/** Full-screen success feedback: emoji, "+N XP" and a continue button. */
export function RewardOverlay({ emoji, title, xp, subtitle, actionLabel = 'Үргэлжлүүлэх', onContinue }: Props) {
  const t = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: t.background }]}>
      <View style={styles.content} accessibilityViewIsModal accessibilityLiveRegion="assertive">
        <View style={styles.sparks} pointerEvents="none">
          {SPARKS.map((s, i) => (
            <Animated.Text key={i} entering={ZoomIn.delay(150 + i * 80).springify()} style={styles.spark}>
              {s}
            </Animated.Text>
          ))}
        </View>
        <Animated.Text entering={BounceIn.delay(100).duration(700)} style={styles.emoji}>
          {emoji}
        </Animated.Text>
        <Animated.View entering={FadeIn.delay(250)}>
          <Text variant="title" center>
            {title}
          </Text>
        </Animated.View>
        {xp > 0 && (
          <Animated.View entering={ZoomIn.delay(400).springify()} style={[styles.xpPill, { backgroundColor: t.gold }]}>
            <Text style={styles.xpText}>+{xp} XP</Text>
          </Animated.View>
        )}
        {subtitle ? (
          <Animated.View entering={FadeIn.delay(500)}>
            <Text color="textSecondary" center>
              {subtitle}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <Animated.View entering={FadeIn.delay(600)} style={styles.footer}>
        <Button title={actionLabel} variant="success" onPress={onContinue} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { zIndex: 50, justifyContent: 'space-between', padding: Spacing.xl },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  sparks: { flexDirection: 'row', gap: Spacing.lg },
  spark: { fontSize: 26 },
  emoji: { fontSize: 96, lineHeight: 112 },
  xpPill: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  xpText: { fontFamily: Fonts.black, fontSize: 28, color: '#fff' },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.lg },
});
