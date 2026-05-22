/**
 * RupeeFast — Card Component
 *
 * Versatile card container with variants, header, footer, and pressable support.
 *
 * @example
 *   <Card>
 *     <Card.Header title="Loan Summary" />
 *     <Text>Content here</Text>
 *     <Card.Footer>
 *       <Button onPress={...}>Action</Button>
 *     </Card.Footer>
 *   </Card>
 *
 *   <Card variant="highlight" pressable onPress={handleTap}>
 *     <Text>Tap me</Text>
 *   </Card>
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, spacing, radii } from '../../theme';
import type { Colors } from '../../theme/colors';

// ── Types ──

type CardVariant = 'default' | 'elevated' | 'highlight' | 'outline' | 'ghost';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  /** Padding preset: 'normal' | 'compact' | 'spacious' | 'none' */
  padding?: 'normal' | 'compact' | 'spacious' | 'none';
  /** Left accent border color (e.g., colors.green for success) */
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned action (e.g., icon button) */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export interface CardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// ── Variant resolver ──

const PADDING_MAP = {
  normal: spacing.xl + 2,
  compact: spacing.lg,
  spacious: spacing.xl4,
  none: 0,
} as const;

// ═══════════════════════════════════════════════════
//  CARD BODY
// ═══════════════════════════════════════════════════

function Card({
  children,
  variant = 'default',
  pressable = false,
  onPress,
  padding = 'normal',
  accentColor,
  style,
}: CardProps) {
  const { colors } = useTheme();
  const pad = PADDING_MAP[padding];

  const cardStyle: ViewStyle = {
    borderRadius: radii.sm,
    overflow: 'hidden',
    ...(variant === 'default' && {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    }),
    ...(variant === 'elevated' && {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    }),
    ...(variant === 'highlight' && {
      backgroundColor: colors.primaryBg,
      borderWidth: 1,
      borderColor: colors.primary,
    }),
    ...(variant === 'outline' && {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
    }),
    ...(variant === 'ghost' && {
      backgroundColor: 'transparent',
      borderWidth: 0,
    }),
    ...(accentColor && {
      borderLeftWidth: 3,
      borderLeftColor: accentColor,
    }),
  };

  const content = (
    <View style={[{ padding: pad }, cardStyle, style as any]}>
      {children}
    </View>
  );

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        })}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ═══════════════════════════════════════════════════
//  CARD HEADER
// ═══════════════════════════════════════════════════

function CardHeader({ title, subtitle, action, style }: CardHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.xl + 2,
        },
        style as any,
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 12,
              color: colors.text3,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {action && <View style={{ marginLeft: spacing.smd }}>{action}</View>}
    </View>
  );
}

// ═══════════════════════════════════════════════════
//  CARD FOOTER
// ═══════════════════════════════════════════════════

function CardFooter({ children, style }: CardFooterProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: spacing.smd,
          marginTop: spacing.xl + 2,
          paddingTop: spacing.xl + 2,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
        },
        style as any,
      ]}
    >
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════
//  Attach sub-components
// ═══════════════════════════════════════════════════

Card.Header = CardHeader;
Card.Footer = CardFooter;

export default Card;
