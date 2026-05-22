/**
 * RupeeFast — Spacing & Layout
 * Mirrors the CSS spacing, radii, and layout constants.
 */

export const spacing = {
  /** 2px */
  xs: 2,
  /** 4px */
  sm: 4,
  /** 6px */
  ssm: 6,
  /** 8px */
  md: 8,
  /** 10px */
  smd: 10,
  /** 12px */
  lg: 12,
  /** 14px */
  xl: 14,
  /** 16px */
  xxl: 16,
  /** 18px */
  xxxl: 18,
  /** 20px */
  xl2: 20,
  /** 22px */
  xl3: 22,
  /** 24px */
  xl4: 24,
  /** 32px */
  xl5: 32,
  /** 36px */
  xl6: 36,
  /** 40px */
  xl7: 40,
  /** 44px */
  xl8: 44,
  /** 48px */
  xl9: 48,
} as const;

export const radii = {
  /** 7px — Input fields, back button */
  xs: 7,
  /** 10px — Cards, buttons */
  sm: 10,
  /** 12px — List icons */
  md: 12,
  /** 14px — Buttons on landing */
  lg: 14,
  /** 16px — Hero cards, cards */
  xl: 16,
  /** 22px — Logo icon on landing */
  xl2: 22,
  /** 24px — Phone container */
  xl3: 24,
  /** 9999 — Badges, toggles */
  full: 9999,
} as const;

export const layout = {
  /** Bottom navigation height */
  navHeight: 64,
  /** Max content width */
  maxWidth: 480,
  /** Top navigation padding top */
  topNavPaddingTop: 14,
  /** Top navigation padding bottom */
  topNavPaddingBottom: 16,
} as const;
