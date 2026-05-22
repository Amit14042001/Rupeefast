/**
 * RupeeFast — TopNav Component
 *
 * Consistent top navigation bar used across all screens.
 * Supports back button, title, right actions, and bottom border variants.
 *
 * @example
 *   <TopNav title="My Profile" onBack={() => router.back()} />
 *   <TopNav title="Apply" right={<Ionicons name="help-circle" size={22} color={colors.text} />} />
 *   <TopNav title="Success" variant="hero" />
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../theme';

// ── Types ──

type NavVariant = 'default' | 'hero' | 'transparent' | 'modal';

export interface TopNavProps {
  title: string;
  /** Show back button (calls onBack) */
  onBack?: () => void;
  /** Right-side action element(s) */
  right?: React.ReactNode;
  /** Visual variant */
  variant?: NavVariant;
  /** Hide bottom border */
  noBorder?: boolean;
  /** Custom background color override */
  backgroundColor?: string;
  /** Custom text color override */
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

// ═══════════════════════════════════════════════════
//  TOP NAV COMPONENT
// ═══════════════════════════════════════════════════

export default function TopNav({
  title,
  onBack,
  right,
  variant = 'default',
  noBorder = false,
  backgroundColor,
  textColor,
  style,
}: TopNavProps) {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  const bg = backgroundColor ?? (
    variant === 'hero' ? colors.primary :
    variant === 'transparent' ? 'transparent' :
    variant === 'modal' ? colors.surface :
    colors.bg
  );

  const titleColor = textColor ?? (
    variant === 'hero' ? '#FFFFFF' : colors.text
  );

  const borderBottom = noBorder ? undefined : (
    variant === 'hero' ? 'transparent' :
    { borderBottomWidth: 1, borderBottomColor: colors.borderLight }
  );

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: top + spacing.smd,
          paddingHorizontal: spacing.xxl,
          paddingBottom: spacing.xl3,
          backgroundColor: bg,
        },
        borderBottom,
        style as any,
      ]}
    >
      {/* Left section — back button or spacer */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => ({
            width: 36,
            height: 36,
            borderRadius: radii.full,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: variant === 'hero'
              ? 'rgba(255,255,255,0.15)'
              : 'transparent',
            opacity: pressed ? 0.7 : 1,
          })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={variant === 'hero' ? '#FFFFFF' : colors.text}
          />
        </Pressable>
      ) : (
        <View style={{ width: 36 }} />
      )}

      {/* Center — title */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 17,
          fontWeight: '700',
          color: titleColor,
          flex: 1,
          textAlign: 'center',
          marginHorizontal: spacing.md,
        }}
      >
        {title}
      </Text>

      {/* Right section */}
      {right ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.smd }}>
          {right}
        </View>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
}
