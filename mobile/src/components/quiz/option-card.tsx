import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Props {
  index: number;
  text: string;
  state: OptionState;
  disabled?: boolean;
  onPress: () => void;
}

export function OptionCard({ index, text, state, disabled, onPress }: Props) {
  const t = useTheme();
  const colors = {
    idle: { border: t.border, bg: t.background, badge: t.surface, badgeText: t.textSecondary },
    selected: { border: t.purple, bg: t.primarySoft, badge: t.purple, badgeText: '#fff' },
    correct: { border: t.green, bg: t.successSoft, badge: t.green, badgeText: '#fff' },
    wrong: { border: t.red, bg: t.dangerSoft, badge: t.red, badgeText: '#fff' },
    dimmed: { border: t.border, bg: t.background, badge: t.surface, badgeText: t.textSecondary },
  }[state];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: state === 'selected' || state === 'correct' || state === 'wrong', disabled }}
      accessibilityLabel={`${LETTERS[index]}: ${text}${state === 'correct' ? ', зөв хариулт' : state === 'wrong' ? ', буруу' : ''}`}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            {
              borderColor: colors.border,
              backgroundColor: colors.bg,
              borderBottomWidth: pressed && !disabled ? 2 : 5,
              marginTop: pressed && !disabled ? 3 : 0,
              opacity: state === 'dimmed' ? 0.55 : 1,
            },
          ]}>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>{LETTERS[index]}</Text>
          </View>
          <Text variant="bodyBold" style={styles.text}>
            {text}
          </Text>
          {state === 'correct' && <Ionicons name="checkmark-circle" size={26} color={t.green} />}
          {state === 'wrong' && <Ionicons name="close-circle" size={26} color={t.red} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderWidth: 2,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: Fonts.black, fontSize: 16 },
  text: { flex: 1 },
});
