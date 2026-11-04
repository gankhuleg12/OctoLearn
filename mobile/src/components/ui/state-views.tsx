import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Text } from './text';

export function LoadingView({ label = 'Ачаалж байна…' }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={t.purple} />
      <Text color="textSecondary">{label}</Text>
    </View>
  );
}

interface MessageProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function MessageView({ icon = 'cloud-offline-outline', title, message, actionLabel, onAction }: MessageProps) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: t.surface }]}>
        <Ionicons name={icon} size={40} color={t.textSecondary} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      {message ? (
        <Text color="textSecondary" center>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <MessageView
      icon="alert-circle-outline"
      title="Алдаа гарлаа"
      message={message}
      actionLabel={onRetry ? 'Дахин оролдох' : undefined}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  action: { alignSelf: 'stretch', marginTop: Spacing.sm, maxWidth: 320, width: '100%' },
});
