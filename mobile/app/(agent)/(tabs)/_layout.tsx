/**
 * RupeeFast — Agent Tab Layout
 *
 * Bottom navigation with 3 tabs:
 *   1. Home     — Route / collection dashboard
 *   2. Tasks    — All tasks list
 *   3. Profile  — Agent profile
 */

import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme, spacing, shadows } from '../../../src/theme';
import { Ionicons } from '@expo/vector-icons';

type TabName = 'home' | 'tasks' | 'profile';

const TAB_ICONS: Record<TabName, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  home:    { focused: 'map',              default: 'map-outline' },
  tasks:   { focused: 'clipboard',        default: 'clipboard-outline' },
  profile: { focused: 'person',           default: 'person-outline' },
};

const TAB_LABELS: Record<TabName, string> = {
  home:     'Routes',
  tasks:    'Tasks',
  profile:  'Profile',
};

export default function AgentTabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: Platform.OS === 'ios' ? 8 : 4,
          paddingTop: 4,
          ...shadows.md,
        } as any,
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: {
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: '500',
          marginTop: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarShowLabel: true,
      }}
    >
      {(['home', 'tasks', 'profile'] as TabName[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarLabel: TAB_LABELS[name],
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? TAB_ICONS[name].focused : TAB_ICONS[name].default}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
