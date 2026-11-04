import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';
import { Text } from './text';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Cross-platform confirm (Alert.alert has no buttons on web). */
export function ConfirmDialog({ visible, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: Props) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Хаах">
        <Pressable style={[styles.card, { backgroundColor: t.background }]} onPress={() => {}} accessibilityViewIsModal>
          <Text variant="heading">{title}</Text>
          <Text color="textSecondary">{message}</Text>
          <View style={styles.actions}>
            <Button title={confirmLabel} variant={danger ? 'danger' : 'primary'} loading={loading} onPress={onConfirm} />
            <Button title="Болих" variant="secondary" disabled={loading} onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,8,20,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  card: { width: '100%', maxWidth: 400, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
});
