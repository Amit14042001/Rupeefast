/**
 * RupeeFast — Color Palette
 * Mirrors the CSS design system in style.css for both light and dark modes.
 */

/** Shared shape for both light and dark palettes */
export interface Colors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryBg: string;

  green: string;
  greenBg: string;
  greenLight: string;

  amber: string;
  amberBg: string;
  amberLight: string;

  red: string;
  redBg: string;
  redLight: string;

  purple: string;
  purpleBg: string;

  bg: string;
  bgDark: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderLight: string;

  text: string;
  text2: string;
  text3: string;
}

export const palette: Colors = {
  // Primary
  primary: '#1B3A6B',
  primaryLight: '#2562A8',
  primaryDark: '#0F2444',
  primaryBg: '#EBF2FB',

  // Semantic — Green
  green: '#0B6B4A',
  greenBg: '#E3F5EE',
  greenLight: '#1A9668',

  // Semantic — Amber
  amber: '#9A6200',
  amberBg: '#FEF3DC',
  amberLight: '#E8930D',

  // Semantic — Red
  red: '#A02020',
  redBg: '#FDEAEA',
  redLight: '#D44040',

  // Semantic — Purple
  purple: '#5A3E9B',
  purpleBg: '#F0EBFF',

  // Neutrals (light)
  bg: '#F0F2F5',
  bgDark: '#E8EBF0',
  surface: '#FFFFFF',
  surfaceHover: '#F8F9FB',
  border: '#E2E5EC',
  borderLight: '#F0F2F6',

  // Text
  text: '#111827',
  text2: '#4B5563',
  text3: '#9CA3AF',
};

export const darkPalette: Colors = {
  primary: '#1B3A6B',
  primaryLight: '#2562A8',
  primaryDark: '#0F2444',
  primaryBg: '#1A2744',

  green: '#0B6B4A',
  greenBg: '#0A2E1F',
  greenLight: '#1A9668',

  amber: '#9A6200',
  amberBg: '#2D1F00',
  amberLight: '#E8930D',

  red: '#A02020',
  redBg: '#2D0F0F',
  redLight: '#D44040',

  purple: '#5A3E9B',
  purpleBg: '#1F143B',

  bg: '#0F1117',
  bgDark: '#181B23',
  surface: '#1A1D28',
  surfaceHover: '#222635',
  border: '#2A2E3E',
  borderLight: '#1F2232',

  text: '#F1F3F7',
  text2: '#9CA3B8',
  text3: '#6B7280',
};

/** Returns the active color palette based on the color scheme */
export function getColors(isDark: boolean): Colors {
  return isDark ? darkPalette : palette;
}
