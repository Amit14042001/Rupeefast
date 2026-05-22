/**
 * RupeeFast — ProgressBar Component
 *
 * Linear progress indicator with label, semantic colors, and animated option.
 *
 * @example
 *   <ProgressBar progress={65} label="Loan Repaid" />
 *   <ProgressBar progress={100} variant="success" showValue />
 *   <ProgressBar progress={30} variant="warning" size="thin" />
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useTheme, spacing, radii } from '../../theme';

// ── Types ──

type ProgressVariant = 'primary' | 'success' | 'warning' | 'error' | 'info';
type ProgressSize = 'thin' | 'normal' | 'thick';

export interface ProgressBarProps {
  /** Progress percentage (0–100) */
  progress: number;
  /** Color variant */
  variant?: ProgressVariant;
  /** Bar thickness */
  size?: ProgressSize;
  /** Show percentage label on the right */
  showValue?: boolean;
  /** Label text on the left */
  label?: string;
  /** Sub-label below the bar */
  sublabel?: string;
  /** Animate progress change */
  animated?: boolean;
}

// ── Resolvers ──

function resolveColor(variant: ProgressVariant, colors: any): string {
  switch (variant) {
    case 'primary': return colors.primary;
    case 'success': return colors.green;
    case 'warning': return colors.amber;
    case 'error': return colors.red;
    case 'info': return colors.purple;
  }
}

function resolveBg(variant: ProgressVariant, colors: any): string {
  switch (variant) {
    case 'primary': return colors.primaryBg;
    case 'success': return colors.greenBg;
    case 'warning': return colors.amberBg;
    case 'error': return colors.redBg;
    case 'info': return colors.purpleBg;
  }
}

const BAR_HEIGHT = { thin: 4, normal: 8, thick: 14 } as const;

// ═══════════════════════════════════════════════════
//  PROGRESS BAR COMPONENT
// ═══════════════════════════════════════════════════

export default function ProgressBar({
  progress,
  variant = 'primary',
  size = 'normal',
  showValue = false,
  label,
  sublabel,
  animated = true,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, progress));
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animWidth, {
        toValue: clamped,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      animWidth.setValue(clamped);
    }
  }, [clamped, animated, animWidth]);

  const barColor = resolveColor(variant, colors);
  const bgColor = resolveBg(variant, colors);
  const height = BAR_HEIGHT[size];

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Label row */}
      {(label || showValue) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {label && (
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text2 }}>
              {label}
            </Text>
          )}
          {showValue && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: barColor }}>
              {Math.round(clamped)}%
            </Text>
          )}
        </View>
      )}

      {/* Bar track */}
      <View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: bgColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            borderRadius: height / 2,
            backgroundColor: barColor,
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>

      {/* Sub-label */}
      {sublabel && (
        <Text style={{ fontSize: 10, color: colors.text3 }}>
          {sublabel}
        </Text>
      )}
    </View>
  );
}
