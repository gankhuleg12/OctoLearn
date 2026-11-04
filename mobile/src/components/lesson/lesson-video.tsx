import { Ionicons } from '@expo/vector-icons';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';

// A jump bigger than this between two time updates is a seek, not playback.
const MAX_NATURAL_STEP_SEC = 1.5;

interface Props {
  uri: string;
  /** Used until the player reports the real duration. */
  fallbackDurationSec: number;
  /** Fraction (0–1) of the video actually played, ignoring seeks. */
  onWatchedChange: (ratio: number) => void;
  paused?: boolean;
}

export function LessonVideo({ uri, fallbackDurationSec, onWatchedChange, paused }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = 0.5;
  });
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });

  const watched = useRef(0);
  const lastTime = useRef(0);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const step = currentTime - lastTime.current;
    lastTime.current = currentTime;
    if (step <= 0 || step > MAX_NATURAL_STEP_SEC) return;
    const duration = player.duration > 0 ? player.duration : fallbackDurationSec;
    watched.current = Math.min(duration, watched.current + step);
    onWatchedChange(watched.current / duration);
  });

  useEventListener(player, 'playToEnd', () => {
    lastTime.current = 0;
  });

  useEffect(() => {
    if (paused) player.pause();
  }, [paused, player]);

  const loading = status === 'loading' || status === 'idle';

  return (
    <View style={styles.frame}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        accessibilityLabel="Хичээлийн видео"
      />
      {loading && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text variant="caption" style={styles.overlayText}>
            Видео ачаалж байна…
          </Text>
        </View>
      )}
      {status === 'error' && (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle" size={36} color="#fff" />
          <Text variant="bodyBold" style={styles.overlayText} center>
            Видео ачаалагдсангүй
          </Text>
          <Text variant="caption" style={[styles.overlayText, { opacity: 0.8 }]} center>
            {error?.message ? 'Интернэт холболтоо шалгаад дахин оролдоно уу.' : 'Дахин оролдоно уу.'}
          </Text>
          <Button
            title="Дахин ачаалах"
            variant="secondary"
            style={styles.retry}
            onPress={() => {
              lastTime.current = 0;
              player.replaceAsync(uri).catch(() => {});
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: Radius.lg, overflow: 'hidden' },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayText: { color: '#fff' },
  retry: { alignSelf: 'center', marginTop: Spacing.sm },
});
