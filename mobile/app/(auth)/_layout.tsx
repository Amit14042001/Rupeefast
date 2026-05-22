/**
 * RupeeFast — Auth Flow Layout
 *
 * Groups the login and OTP screens in a stack navigator
 * with no header (custom header built into each screen).
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
