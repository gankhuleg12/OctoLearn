import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { Fonts, Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

interface Props extends Omit<TextInputProps, 'ref'> {
  label: string;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ label, style, ref, ...rest }: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSecondary">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={t.textSecondary}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: focused ? t.purple : t.border },
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: TouchTarget + 4,
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    fontFamily: Fonts.semibold,
    fontSize: 16,
  },
});
