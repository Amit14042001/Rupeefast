import { Platform } from 'react-native';

/**
 * RupeeFast — Shadow Presets
 * Maps CSS box-shadows to React Native shadow props.
 * iOS uses shadow properties; Android uses elevation.
 */

export const shadows = {
  /** CSS: 0 1px 2px rgba(0,0,0,0.04) */
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
  }),

  /** CSS: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04) */
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
  }),

  /** CSS: 0 12px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04) */
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 40,
    },
    android: {
      elevation: 8,
    },
  }),

  /** CSS: 0 24px 60px rgba(0,0,0,0.12) */
  xl: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.12,
      shadowRadius: 60,
    },
    android: {
      elevation: 16,
    },
  }),

  /** CSS: 0 0 20px rgba(27, 58, 107, 0.15) — primary glow */
  glow: Platform.select({
    ios: {
      shadowColor: '#1B3A6B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    },
    android: {
      elevation: 6,
    },
  }),

  /** For button presses */
  none: Platform.select({
    ios: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: {
      elevation: 0,
    },
  }),
} as const;

export type ShadowName = keyof typeof shadows;
