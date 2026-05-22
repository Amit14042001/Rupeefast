/**
 * RupeeFast — Badge Component
 *
 * Small status badge with semantic color variants and optional icon.
 *
 * @example
 *   <Badge variant="success">Verified</Badge>
 *   <Badge variant="warning" icon="time">Pending</Badge>
 *   <Badge variant="error" size="sm">3</Badge>
 *   <Badge variant="info" dot>Online</Badge>
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../theme';
import type { Colors } from '../../theme/colors';

// ── Types ──

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Optional icon name from Ionicons */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Show as small dot indicator (hides text) */
  dot?: boolean;
  /** Outline style instead of filled */
  outline?: boolean;
}

// ── Variant resolver ──

interface BadgeStyle {
  bg: string;
  text: string;
  dot: string;
}

function resolveBadge(variant: BadgeVariant, colors: Colors): BadgeStyle {
  switch (variant) {
    case 'primary':
      return { bg: colors.primaryBg, text: colors.primary, dot: colors.primary };
    case 'success':
      return { bg: colors.greenBg, text: colors.green, dot: colors.green };
    case 'warning':
      return { bg: colors.amberBg, text: colors.amber, dot: colors.amber };
    case 'error':
      return { bg: colors.redBg, text: colors.red, dot: colors.red };
    case 'info':
      return { bg: colors.purpleBg, text: colors.purple, dot: colors.purple };
    case 'default':
    default:
      return { bg: colors.borderLight, text: colors.text2, dot: colors.text3 };
  }
}

// ═══════════════════════════════════════════════════
//  BADGE COMPONENT
// ═══════════════════════════════════════════════════

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  dot = false,
  outline = false,
}: BadgeProps) {
  const { colors } = useTheme();
  const vs = resolveBadge(variant, colors);

  // Dot mode — tiny circle
  if (dot) {
    return (
      <View
        style={{
          width: size === 'sm' ? 6 : 8,
          height: size === 'sm' ? 6 : 8,
          borderRadius: 999,
          backgroundColor: vs.dot,
        }}
      />
    );
  }

  const textSize = size === 'sm' ? 9 : 10;
  const iconSize = size === 'sm' ? 10 : 12;
  const py = size === 'sm' ? spacing.xs : spacing.ssm - 1;
  const px = size === 'sm' ? spacing.md : spacing.smd + 2;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: py,
        paddingHorizontal: px,
        borderRadius: radii.full,
        backgroundColor: outline ? 'transparent' : vs.bg,
        borderWidth: outline ? 1 : 0,
        borderColor: vs.text,
        alignSelf: 'flex-start',
      }}
    >
      {icon && (
        <Ionicons name={icon} size={iconSize} color={vs.text} />
      )}
      {typeof children === 'string' ? (
        <Text
          style={{
            fontSize: textSize,
            fontWeight: '600',
            color: vs.text,
            letterSpacing: 0.3,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
