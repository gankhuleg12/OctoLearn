import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Fonts, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyBold' | 'caption' | 'label';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: keyof ThemeColors;
  center?: boolean;
}

export function Text({ variant = 'body', color = 'text', center, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[styles[variant], { color: theme[color] }, center && styles.center, style]}
      maxFontSizeMultiplier={1.4}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.black, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: Fonts.extrabold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: Fonts.extrabold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 23 },
  caption: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: Fonts.extrabold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  center: { textAlign: 'center' },
});
