/**
 * RupeeFast — Typography System
 * Font families: Inter (UI), Plus Jakarta Sans (Display)
 */

export const fontFamilies = {
  ui: 'Inter' as const,
  display: 'PlusJakartaSans' as const,
};

export const fontWeights = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const fontSizes = {
  /** 10px — Caption, badges */
  xxs: 10,
  /** 11px — Section headers, labels */
  xs: 11,
  /** 12px — Subtitles, secondary info */
  sm: 12,
  /** 13px — Body, chat messages */
  md: 13,
  /** 14px — Buttons, cards body */
  base: 14,
  /** 15px — Primary buttons */
  lg: 15,
  /** 17px — Top nav titles */
  xl: 17,
  /** 22px — Metric values */
  xxl: 22,
  /** 24px — Success overlay */
  xxxl: 24,
  /** 34px — Logo / hero */
  hero: 34,
} as const;

export const lineHeights = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
};

/** Typography presets for common text styles */
export const typography = {
  h1: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.hero,
    fontWeight: fontWeights.extrabold,
    lineHeight: lineHeights.tight,
    letterSpacing: -1,
  },
  h2: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.extrabold,
    lineHeight: lineHeights.tight,
  },
  h3: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.relaxed,
  },
  body: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.relaxed,
  },
  bodySmall: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  caption: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.normal,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
    letterSpacing: 0.1,
  },
  buttonSmall: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
  },
  metric: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
  },
  label: {
    fontFamily: fontFamilies.ui,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.normal,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
} as const;
