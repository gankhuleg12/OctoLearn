import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

// Deterministic color per name so each learner keeps the same avatar color.
const AVATAR_COLORS = ['#7C5CFF', '#22C55E', '#FF7A1A', '#0EA5E9', '#EC4899', '#F59E0B'];

function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const t = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      accessible={false}
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: url ? t.surface : colorFor(name) }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={{ fontFamily: Fonts.black, fontSize: size * 0.42, color: '#fff' }}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
