/**
 * RupeeFast — Skeleton Component
 *
 * Animated loading placeholders that match real content shape.
 * Includes presets for common layouts.
 *
 * @example
 *   <Skeleton width={200} height={14} />
 *   <Skeleton circle width={48} height={48} />
 *   <Skeleton.Card />
 *   <Skeleton.List count={3} />
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, spacing, radii } from '../../theme';

// ── Types ──

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  /** Round shape (circle) */
  circle?: boolean;
  /** Border radius override */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

// ── Animated shimmer ──

function Skeleton({
  width = '100%',
  height = 14,
  circle = false,
  borderRadius,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const br = circle ? 9999 : (borderRadius ?? 6);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: br,
          backgroundColor: colors.borderLight,
          opacity,
        },
        style as any,
      ]}
    />
  );
}

// ═══════════════════════════════════════════════════
//  PRESET SKELETON LAYOUTS
// ═══════════════════════════════════════════════════

/** Full card skeleton — good for dashboard cards */
function SkeletonCard() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl + 2,
        gap: spacing.lg,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width={120} height={14} />
        <Skeleton width={60} height={14} />
      </View>
      {/* Body */}
      <Skeleton width="80%" height={28} />
      <Skeleton width="100%" height={14} />
      <Skeleton width="60%" height={14} />
      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.smd }}>
        <Skeleton width={80} height={36} borderRadius={7} />
      </View>
    </View>
  );
}

/** List row skeleton — good for schedules, histories */
function SkeletonRow({ hasIcon = true }: { hasIcon?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      {hasIcon && <Skeleton circle width={36} height={36} />}
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={10} />
      </View>
      <Skeleton width={50} height={12} />
    </View>
  );
}

/** List skeleton — multiple rows */
function SkeletonList({ count = 3, hasIcon = true }: { count?: number; hasIcon?: boolean }) {
  return (
    <View style={{ gap: spacing.xl + 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} hasIcon={hasIcon} />
      ))}
    </View>
  );
}

/** Metric skeleton — for hero numbers */
function SkeletonMetric() {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <Skeleton width={80} height={36} />
      <Skeleton width={100} height={12} />
    </View>
  );
}

/** Full screen skeleton for loading state */
function SkeletonScreen() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.xl + 2 }}>
      {/* Top nav skeleton */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.smd }}>
        <Skeleton circle width={36} height={36} />
        <Skeleton width={140} height={17} />
      </View>
      {/* Hero section */}
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl4 }}>
        <Skeleton circle width={70} height={70} />
        <Skeleton width={120} height={22} />
        <Skeleton width={200} height={14} />
      </View>
      {/* Cards */}
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

// ═══════════════════════════════════════════════════
//  Attach presets
// ═══════════════════════════════════════════════════

Skeleton.Card = SkeletonCard;
Skeleton.Row = SkeletonRow;
Skeleton.List = SkeletonList;
Skeleton.Metric = SkeletonMetric;
Skeleton.Screen = SkeletonScreen;

export default Skeleton;
