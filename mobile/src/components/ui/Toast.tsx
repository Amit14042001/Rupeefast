/**
 * RupeeFast — Toast Component
 *
 * Temporary notification that slides in from the top.
 * Supports success, error, warning, and info variants.
 * Controlled via imperative `show()` / `hide()` or as a controlled component.
 *
 * @example
 *   // Imperative usage
 *   const toastRef = useRef<ToastRef>(null);
 *   toastRef.current?.show({ message: 'Payment successful!', variant: 'success' });
 *   <Toast ref={toastRef} />
 *
 *   // Controlled usage
 *   <Toast visible={showToast} message="Saved!" variant="success" onDismiss={() => setShowToast(false)} />
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  Animated,
  Text,
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../theme';
import type { Colors } from '../../theme/colors';

// ── Types ──

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms (default 3000, 0 = no auto-dismiss) */
  duration?: number;
}

export interface ToastRef {
  show: (options: ToastOptions) => void;
  hide: () => void;
}

export interface ToastProps {
  /** Controlled visible state */
  visible?: boolean;
  message?: string;
  description?: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  /** Bar position */
  position?: 'top' | 'bottom';
}

// ── Variant resolver ──

interface StyleVars {
  bg: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

function resolveStyle(variant: ToastVariant, colors: Colors): StyleVars {
  switch (variant) {
    case 'success':
      return { bg: colors.green, text: '#FFFFFF', icon: 'checkmark-circle', iconColor: '#FFFFFF' };
    case 'error':
      return { bg: colors.red, text: '#FFFFFF', icon: 'alert-circle', iconColor: '#FFFFFF' };
    case 'warning':
      return { bg: colors.amber, text: '#FFFFFF', icon: 'warning', iconColor: '#FFFFFF' };
    case 'info':
      return { bg: colors.primary, text: '#FFFFFF', icon: 'information-circle', iconColor: '#FFFFFF' };
  }
}

// ═══════════════════════════════════════════════════
//  TOAST COMPONENT
// ═══════════════════════════════════════════════════

function ToastComponent(props: ToastProps, ref: React.Ref<ToastRef>) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ToastOptions>({
    message: '',
    variant: 'info',
  });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateIn = useCallback(() => {
    translateY.setValue(-100);
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  }, [translateY]);

  const animateOut = useCallback((onDone?: () => void) => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      onDone?.();
    });
  }, [translateY]);

  const show = useCallback(
    (opts: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setOptions(opts);
      setVisible(true);
      animateIn();
      if (opts.duration !== 0) {
        hideTimer.current = setTimeout(() => {
          animateOut();
        }, opts.duration ?? 3000);
      }
    },
    [animateIn, animateOut],
  );

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    animateOut(props.onDismiss);
  }, [animateOut, props.onDismiss]);

  useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);

  // Controlled mode
  useEffect(() => {
    if (props.visible !== undefined) {
      if (props.visible) {
        setOptions({
          message: props.message || '',
          description: props.description,
          variant: props.variant || 'info',
        });
        setVisible(true);
        animateIn();
      } else {
        animateOut(props.onDismiss);
      }
    }
  }, [props.visible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  const sv = resolveStyle(options.variant || 'info', colors);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: sv.bg,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={hide}
        style={({ pressed }) => [
          styles.inner,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name={sv.icon} size={20} color={sv.iconColor} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.message, { color: sv.text }]}>
            {options.message}
          </Text>
          {options.description && (
            <Text style={[styles.description, { color: sv.text }]}>
              {options.description}
            </Text>
          )}
        </View>
        <Ionicons name="close" size={16} color={sv.text} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderBottomLeftRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    paddingTop: 50, // safe area inset handled by parent
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.85,
  },
});

export default forwardRef(ToastComponent);
