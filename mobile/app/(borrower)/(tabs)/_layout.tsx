/**
 * RupeeFast — Borrower Tab Layout
 *
 * Bottom navigation with 4 tabs:
 *   1. Home       — Dashboard (hero, metrics, schedule)
 *   2. Apply      — Loan application
 *   3. Schedule   — Full EMI schedule
 *   4. Account    — Profile & settings hub
 *
 * Uses expo-router's Tabs navigator with fully custom styling
 * that matches the existing WebView design system.
 */

import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme, spacing } from '../../../src/theme';
import { Ionicons } from '@expo/vector-icons';

type TabName = 'home' | 'apply' | 'schedule' | 'account';

const TAB_ICONS: Record<TabName, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  home:    { focused: 'home',       default: 'home-outline' },
  apply:   { focused: 'add-circle', default: 'add-circle-outline' },
  schedule:{ focused: 'calendar',   default: 'calendar-outline' },
  account: { focused: 'person',     default: 'person-outline' },
};

const TAB_LABELS: Record<TabName, string> = {
  home:     'Home',
  apply:    'Apply',
  schedule: 'Schedule',
  account:  'Account',
};

export default function BorrowerTabLayout() {
  const { colors, shadows } = useTheme();

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
        tabBarActiveTintColor: colors.primary,
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
      {(['home', 'apply', 'schedule', 'account'] as TabName[]).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            tabBarLabel: TAB_LABELS[name],
            tabBarIcon: ({ focused, color, size }) => (
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
