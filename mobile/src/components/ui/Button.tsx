/**
 * RupeeFast — Button Component
 *
 * Primary action button with variants, loading state, and icon support.
 */

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../theme';
import type { Colors } from '../../theme/colors';

// ── Types ──

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// ── Variant resolver ──

interface VariantStyle {
  bg: string;
  text: string;
  border?: string;
  disabledText?: string;
  pressedBg: string;
  disabledBg: string;
}

function resolveVariant(variant: ButtonVariant, colors: Colors): VariantStyle {
  switch (variant) {
    case 'primary':
      return { bg: colors.primary, text: '#FFFFFF', pressedBg: colors.primaryDark, disabledBg: colors.text3 };
    case 'secondary':
      return { bg: colors.primaryBg, text: colors.primary, pressedBg: colors.borderLight, disabledBg: colors.borderLight, disabledText: colors.text3 };
    case 'ghost':
      return { bg: 'transparent', text: colors.primary, pressedBg: colors.primaryBg, disabledBg: 'transparent', disabledText: colors.text3 };
    case 'danger':
      return { bg: colors.red, text: '#FFFFFF', pressedBg: colors.redLight, disabledBg: colors.text3 };
    case 'outline':
      return { bg: 'transparent', text: colors.primary, border: colors.primary, pressedBg: colors.primaryBg, disabledBg: 'transparent', disabledText: colors.text3 };
    default:
      return { bg: colors.primary, text: '#FFFFFF', pressedBg: colors.primaryDark, disabledBg: colors.text3 };
  }
}

// ── Size resolver ──

interface SizeStyle { py: number; px: number; fontSize: number; iconSize: number }

function resolveSize(size: ButtonSize): SizeStyle {
  switch (size) {
    case 'sm': return { py: spacing.smd, px: spacing.xl, fontSize: 12, iconSize: 14 };
    case 'md': return { py: spacing.xl, px: spacing.xl4, fontSize: 14, iconSize: 16 };
    case 'lg': return { py: spacing.xl + 4, px: spacing.xl5, fontSize: 15, iconSize: 18 };
  }
}

// ═══════════════════════════════════════════════════
//  BUTTON COMPONENT
// ═══════════════════════════════════════════════════

export default function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const vs = resolveVariant(variant, colors);
  const sz = resolveSize(size);
  const isInactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          paddingVertical: sz.py,
          paddingHorizontal: sz.px,
          borderRadius: radii.sm,
          backgroundColor: isInactive ? vs.disabledBg : pressed ? vs.pressedBg : vs.bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: isInactive ? colors.border : vs.border || 'transparent',
          opacity: isInactive ? 0.6 : 1,
          transform: [{ scale: pressed && !isInactive ? 0.97 : 1 }],
        },
        fullWidth && { width: '100%' },
        style as any,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.primary} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Ionicons name={icon} size={sz.iconSize} color={isInactive ? colors.text3 : vs.text} />
          )}
          {typeof children === 'string' ? (
            <Text style={[{ fontSize: sz.fontSize, color: isInactive && variant !== 'primary' && variant !== 'danger' ? vs.disabledText || colors.text3 : vs.text }, textStyle as any]}>
              {children}
            </Text>
          ) : (
            children
          )}
          {icon && iconPosition === 'right' && (
            <Ionicons name={icon} size={sz.iconSize} color={isInactive ? colors.text3 : vs.text} />
          )}
        </>
      )}
    </Pressable>
  );
}
