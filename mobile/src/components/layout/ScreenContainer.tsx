/**
 * RupeeFast — ScreenContainer Component
 *
 * Standard screen wrapper that applies safe area insets, global background,
 * and consistent padding. Reduces boilerplate in every screen file.
 *
 * @example
 *   <ScreenContainer>
 *     <Text>Content</Text>
 *   </ScreenContainer>
 *
 *   <ScreenContainer scroll padded={false}>
 *     <Content />
 *   </ScreenContainer>
 *
 *   <ScreenContainer scroll refreshing onRefresh={handleRefresh}>
 *     <List />
 *   </ScreenContainer>
 */

import React from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing } from '../../theme';

// ── Types ──

export interface ScreenContainerProps {
  children: React.ReactNode;
  /** Enable scrollable content */
  scroll?: boolean;
  /** Apply standard horizontal padding */
  padded?: boolean;
  /** Show pull-to-refresh (requires scroll + onRefresh) */
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Override background color */
  backgroundColor?: string;
  /** Extra styles */
  style?: StyleProp<ViewStyle>;
  /** Optional safe area edges to exclude */
  excludeEdges?: ('top' | 'bottom')[];
  /** Extra bypass for bottom nav — auto scroll inset */
  bottomInset?: boolean;
}

// ═══════════════════════════════════════════════════
//  SCREEN CONTAINER COMPONENT
// ═══════════════════════════════════════════════════

export default function ScreenContainer({
  children,
  scroll = false,
  padded = true,
  refreshing = false,
  onRefresh,
  backgroundColor,
  style,
  excludeEdges = [],
  bottomInset = false,
}: ScreenContainerProps) {
  const { top, bottom } = useSafeAreaInsets();
  const { colors } = useTheme();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: backgroundColor ?? colors.bg,
    paddingTop: excludeEdges.includes('top') ? 0 : 0, // safe area top not applied automatically
    paddingBottom: bottomInset ? bottom : 0,
  };

  const paddingHorizontal = padded ? spacing.lg : 0;

  // Non-scrollable
  if (!scroll) {
    return (
      <View style={[containerStyle, style as any]}>
        <View style={{ flex: 1, paddingHorizontal }}>{children}</View>
      </View>
    );
  }

  // Scrollable with optional pull-to-refresh
  return (
    <View style={containerStyle}>
      <ScrollView
        style={[{ flex: 1 }, style as any]}
        contentContainerStyle={{
          paddingBottom: 64, // bottom nav height
          paddingHorizontal,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
