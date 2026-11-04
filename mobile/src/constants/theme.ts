/**
 * OctoLearn design tokens. Every screen pulls colors, type and spacing from
 * here so buttons, cards and spacing stay consistent across the app.
 */

const palette = {
  purple: '#7C5CFF',
  purpleDark: '#5B3FD9',
  green: '#22C55E',
  greenDark: '#16A34A',
  red: '#EF4444',
  redDark: '#C53030',
  gold: '#FFB020',
  goldDark: '#D98E00',
  orange: '#FF7A1A',
} as const;

export const Colors = {
  light: {
    ...palette,
    text: '#1D1B2C',
    textSecondary: '#6B6880',
    background: '#FFFFFF',
    surface: '#F6F5FB',
    surfaceStrong: '#ECEAF5',
    border: '#E4E2EE',
    locked: '#D9D7E3',
    lockedDark: '#B9B6C8',
    primarySoft: '#EFEAFF',
    successSoft: '#E5F8EC',
    dangerSoft: '#FDECEC',
    onPrimary: '#FFFFFF',
  },
  dark: {
    ...palette,
    text: '#F3F2F8',
    textSecondary: '#A9A5BF',
    background: '#121119',
    surface: '#1C1A26',
    surfaceStrong: '#262433',
    border: '#2F2C3E',
    locked: '#383547',
    lockedDark: '#2A2838',
    primarySoft: '#2A2347',
    successSoft: '#123222',
    dangerSoft: '#3A1A1D',
    onPrimary: '#FFFFFF',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

/** Minimum touch target (iOS HIG 44pt / Material 48dp). */
export const TouchTarget = 48;

export const MaxContentWidth = 560;
