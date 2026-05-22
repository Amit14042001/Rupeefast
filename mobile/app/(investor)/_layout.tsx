/**
 * RupeeFast — Investor Tab Layout
 *
 * Bottom navigation with 4 tabs:
 *   1. Home     — Portfolio overview dashboard
 *   2. Invest   — Deploy capital
 *   3. Loans    — Borrower list
 *   4. Profile  — Account settings
 */

import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme, spacing, radii, shadows } from '../../src/theme';
import { Ionicons } from '@expo/vector-icons';

type TabName = 'home' | 'invest' | 'loans' | 'profile';

const TAB_ICONS: Record<TabName, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  home:    { focused: 'stats-chart',       default: 'stats-chart-outline' },
  invest:  { focused: 'add-circle',        default: 'add-circle-outline' },
  loans:   { focused: 'people',            default: 'people-outline' },
  profile: { focused: 'person',            default: 'person-outline' },
};

const TAB_LABELS: Record<TabName, string> = {
  home:     'Overview',
  invest:   'Invest',
  loans:    'Borrowers',
  profile:  'Profile',
};

export default function InvestorTabLayout() {
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
        tabBarActiveTintColor: colors.green,
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
      {(['home', 'invest', 'loans', 'profile'] as TabName[]).map((name) => (
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
