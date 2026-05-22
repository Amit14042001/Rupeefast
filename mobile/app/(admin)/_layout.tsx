/**
 * RupeeFast — Admin Tab Layout
 *
 * Bottom navigation with scrollable tabs:
 *   Dashboard | KYC Review | Fraud | Collections |
 *   Users | Loans | Agents | Reports | Audit | Settings
 */

import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScrollableTabBar, { ADMIN_TABS } from './_components/ScrollableTabBar';
import { useTheme } from '../../src/theme';

export default function AdminTabLayout() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderTabBar = useCallback(
    (props: any) => (
      <View style={{ paddingBottom: bottom }}>
        <ScrollableTabBar
          activeTab={activeTab}
          onTabPress={(name) => {
            setActiveTab(name);
            props.navigation.navigate(name);
          }}
        />
      </View>
    ),
    [activeTab, bottom],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={renderTabBar}
    >
      {ADMIN_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
