import { useColorScheme } from 'react-native';

import { Colors, type ThemeColors } from '@/constants/theme';
import { useSettings } from '@/store/settings';

/** Colors for the user's chosen mode ("system" follows the device setting). */
export function useTheme(): ThemeColors & { scheme: 'light' | 'dark' } {
  const system = useColorScheme();
  const mode = useSettings((s) => s.themeMode);
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  return { ...Colors[scheme], scheme };
}
