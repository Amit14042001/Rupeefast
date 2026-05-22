/**
 * RupeeFast — Unified Theme
 * Provides a useTheme() hook that returns the active palette,
 * typography, spacing, radii, and shadows based on color scheme.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getColors, type Colors } from './colors';
import { typography } from './typography';
import { spacing, radii, layout } from './spacing';
import { shadows, type ShadowName } from './shadows';

export type Theme = {
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  layout: typeof layout;
  shadows: Record<ShadowName, any>;
  isDark: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const theme = useMemo<Theme>(
    () => ({
      colors: getColors(isDark),
      typography,
      spacing,
      radii,
      layout,
      shadows: shadows as Record<ShadowName, any>,
      isDark,
    }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme.
 * Must be used within a <ThemeProvider>.
 */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

// Re-exports for convenience
export { getColors } from './colors';
export { typography, fontFamilies, fontSizes, fontWeights } from './typography';
export { spacing, radii, layout } from './spacing';
export { shadows } from './shadows';
export type { Colors } from './colors';
