import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Icon + 16px label must fit the tab item; larger icons clip the label.
const ICON_SIZE = 22;

function tabIcon(active: IconName, inactive: IconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={ICON_SIZE} color={color as string} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.purple,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarStyle: {
          backgroundColor: t.background,
          borderTopColor: t.border,
          borderTopWidth: 2,
          // Native bars size themselves around the safe area; on web give the label room.
          ...Platform.select({ web: { height: 64, paddingTop: 4, paddingBottom: 4 } }),
        },
        tabBarLabelStyle: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Нүүр', tabBarIcon: tabIcon('map', 'map-outline') }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Чансаа', tabBarIcon: tabIcon('trophy', 'trophy-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Профайл', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
