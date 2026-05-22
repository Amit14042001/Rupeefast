/**
 * RupeeFast — Agent Root Layout (Stack)
 *
 * Uses a Stack navigator to wrap both the tab screens (nested under (tabs))
 * and standalone stack screens (collection-log, acquire, verify, etc.).
 * The tab bar is only visible on the 3 tab screens defined in (tabs)/_layout.tsx.
 */

import { Stack } from 'expo-router';

export default function AgentLayout() {
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
      <Stack.Screen name="acquire" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="recovery" />
      <Stack.Screen name="recovery-detail" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="verify-detail" />
      <Stack.Screen name="collection-log" />
    </Stack>
  );
}
