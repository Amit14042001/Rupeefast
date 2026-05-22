/**
 * RupeeFast — Custom Scrollable Tab Bar for Admin Panel
 *
 * Renders a horizontally scrollable row of tab buttons that works
 * with expo-router's Tabs navigator via the `tabBar` prop.
 */

import { useCallback, useRef, useEffect } from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';

// ── Tab definition ──

export interface TabConfig {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
}

export const ADMIN_TABS: TabConfig[] = [
  { name: 'dashboard',    label: 'Dashboard',    icon: 'speedometer-outline',     iconFocused: 'speedometer' },
  { name: 'kyc-review',   label: 'KYC Review',   icon: 'shield-checkmark-outline', iconFocused: 'shield-checkmark' },
  { name: 'fraud',        label: 'Fraud',         icon: 'warning-outline',         iconFocused: 'warning' },
  { name: 'collections',  label: 'Collections',   icon: 'wallet-outline',          iconFocused: 'wallet' },
  { name: 'users',        label: 'Users',         icon: 'people-outline',          iconFocused: 'people' },
  { name: 'loans',        label: 'Loans',         icon: 'receipt-outline',         iconFocused: 'receipt' },
  { name: 'agents',       label: 'Agents',        icon: 'briefcase-outline',       iconFocused: 'briefcase' },
  { name: 'reports',      label: 'Reports',       icon: 'bar-chart-outline',       iconFocused: 'bar-chart' },
  { name: 'audit',        label: 'Audit',         icon: 'document-text-outline',   iconFocused: 'document-text' },
  { name: 'settings',     label: 'Settings',      icon: 'settings-outline',        iconFocused: 'settings' },
  { name: 'broadcast',      label: 'Broadcast',      icon: 'megaphone-outline',         iconFocused: 'megaphone' },
  { name: 'api-management', label: 'API Mgmt',       icon: 'code-slash-outline',          iconFocused: 'code-slash' },
  { name: 'investors',      label: 'Investors',      icon: 'briefcase-outline',            iconFocused: 'briefcase' },
];

// ── Component ──

interface Props {
  activeTab: string;
  onTabPress: (name: string) => void;
}

export default function ScrollableTabBar({ activeTab, onTabPress }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndex = ADMIN_TABS.findIndex((t) => t.name === activeTab);

  // Auto-scroll to keep the active tab visible
  useEffect(() => {
    if (activeIndex >= 0 && scrollRef.current) {
      const x = activeIndex * 80 - 40; // approximate offset
      scrollRef.current.scrollTo({ x: Math.max(0, x), animated: true });
    }
  }, [activeIndex]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ADMIN_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.name;
          return (
            <Pressable
              key={tab.name}
              style={({ pressed }) => [
                styles.tabItem,
                { backgroundColor: isActive ? colors.primary : 'transparent' },
                pressed && !isActive && { backgroundColor: colors.surfaceHover },
              ]}
              onPress={() => onTabPress(tab.name)}
            >
              <Ionicons
                name={isActive ? tab.iconFocused : tab.icon}
                size={20}
                color={isActive ? '#fff' : colors.text3}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? '#fff' : colors.text3 },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl + 2,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minWidth: 64,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
  },
});
