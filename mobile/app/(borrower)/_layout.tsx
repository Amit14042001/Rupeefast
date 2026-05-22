/**
 * RupeeFast — Borrower Root Layout (Stack)
 *
 * Uses a Stack navigator to wrap both the tab screens (nested under (tabs))
 * and standalone stack screens (KYC, AI Score, Offer, Pay, Settings, etc.).
 * The tab bar is only visible on the 4 tab screens defined in (tabs)/_layout.tsx.
 */

import { Stack } from 'expo-router';

export default function BorrowerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Tab screens — wrapped in their own Tabs layout */}
      <Stack.Screen name="(tabs)" />

      {/* Stack screens — no tab bar, full-screen */}
      <Stack.Screen name="pay" />
      <Stack.Screen name="kyc" />
      <Stack.Screen name="ai-score" />
      <Stack.Screen name="offer" />
      <Stack.Screen name="history" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="refer" />
      <Stack.Screen name="help" />
      <Stack.Screen name="score" />
      <Stack.Screen name="loyalty" />
      <Stack.Screen name="group" />
      <Stack.Screen name="mandates" />
      <Stack.Screen name="offers-list" />
    </Stack>
  );
}
