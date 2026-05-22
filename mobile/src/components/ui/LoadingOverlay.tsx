/**
 * RupeeFast — LoadingOverlay Component
 *
 * Full-screen semi-transparent loading overlay with spinner and optional message.
 *
 * @example
 *   <LoadingOverlay visible={isLoading} message="Processing payment..." />
 *   <LoadingOverlay visible={isLoading} variant="minimal" />
 *   <LoadingOverlay visible={isLoading} variant="card" message="Verifying KYC...">
 *     <Text style={{ color: '#fff' }}>Do not close the app</Text>
 *   </LoadingOverlay>
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  Modal,
  StyleSheet,
} from 'react-native';
import { useTheme, spacing, radii } from '../../theme';

// ── Types ──

type LoadingVariant = 'fullscreen' | 'minimal' | 'card';

export interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  variant?: LoadingVariant;
  /** Children shown below the message (e.g., additional instructions) */
  children?: React.ReactNode;
}

// ═══════════════════════════════════════════════════
//  LOADING OVERLAY COMPONENT
// ═══════════════════════════════════════════════════

export default function LoadingOverlay({
  visible,
  message,
  variant = 'fullscreen',
  children,
}: LoadingOverlayProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  const content = (
    <Animated.View
      style={[
        styles.overlay,
        {
          backgroundColor: variant === 'minimal' ? 'transparent' : 'rgba(0,0,0,0.5)',
          opacity: variant === 'minimal' ? 1 : fadeAnim,
        },
      ]}
    >
      {variant === 'card' ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.sm,
            padding: spacing.xl5,
            alignItems: 'center',
            gap: spacing.xl,
            minWidth: 200,
            maxWidth: 280,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          {message && (
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: colors.text,
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
          )}
          {children}
        </View>
      ) : (
        <View
          style={{
            alignItems: 'center',
            gap: spacing.xl,
            paddingHorizontal: spacing.xl5,
          }}
        >
          <ActivityIndicator
            size={variant === 'minimal' ? 'small' : 'large'}
            color={variant === 'minimal' ? colors.primary : '#FFFFFF'}
          />
          {message && (
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: variant === 'minimal' ? colors.text : '#FFFFFF',
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
          )}
          {children}
        </View>
      )}
    </Animated.View>
  );

  // Fullscreen uses Modal to block interaction
  if (variant === 'fullscreen') {
    return (
      <Modal transparent animationType="none" visible={visible}>
        {content}
      </Modal>
    );
  }

  // Minimal and card are inline — overlay only
  return content;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
