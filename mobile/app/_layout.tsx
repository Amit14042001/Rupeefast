/**
 * RupeeFast — Root Layout
 *
 * Provides:
 *   1. ThemeProvider (light/dark color scheme)
 *   2. Auth store hydration on mount
 *   3. Consistent StatusBar
 *   4. Stack navigator for the entire app
 *
 * TODO Phase 2: Load custom fonts (Inter, PlusJakartaSans) via expo-font
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { ThemeProvider, useTheme } from '../src/theme';
import { useAuthStore } from '../src/stores/auth-store';

function AppContent({ children }: { children: React.ReactNode }) {
  const { colors, isDark, layout } = useTheme();

  useEffect(() => {
    useAuthStore.getState().hydrate();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContent>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          {/* Landing / Role Select */}
          <Stack.Screen name="index" />

          {/* Auth Flow (grouped in (auth)) */}
          <Stack.Screen name="(auth)" />

          {/* Borrower Flow (grouped in (borrower)) */}
          <Stack.Screen name="(borrower)" />

          {/* Investor Flow (grouped in (investor)) */}
          <Stack.Screen name="(investor)" />

          {/* Agent Flow (grouped in (agent)) */}
          <Stack.Screen name="(agent)" />

          {/* Admin Panel (grouped in (admin)) */}
          <Stack.Screen name="(admin)" />
        </Stack>
      </AppContent>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
