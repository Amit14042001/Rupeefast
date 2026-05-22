/**
 * RupeeFast — ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in its child component tree,
 * logs them, and displays a fallback UI instead of a white screen.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Clipboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../theme';
import type { Colors } from '../theme/colors';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ── Default Fallback UI ──

function DefaultFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleCopyError = () => {
    const errorText = [
      `Error: ${error?.name}`,
      `Message: ${error?.message}`,
      `Stack: ${error?.stack}`,
    ].join('\n\n');
    Clipboard.setString(errorText);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: top }]}>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.redBg }]}>
          <Ionicons name="warning" size={40} color={colors.red} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>
          Something went wrong
        </Text>
        <Text style={[styles.subtitle, { color: colors.text3 }]}>
          An unexpected error occurred. Please try again.
        </Text>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.redBg, borderColor: colors.redLight }]}>
            <Text style={[styles.errorName, { color: colors.red }]}>{error.name}</Text>
            <ScrollView style={styles.errorScroll} showsVerticalScrollIndicator>
              <Text style={[styles.errorMessage, { color: colors.text }]}>{error.message}</Text>
              {error.stack && (
                <Text style={[styles.errorStack, { color: colors.text3 }]}>{error.stack}</Text>
              )}
            </ScrollView>
            <Pressable
              onPress={handleCopyError}
              style={({ pressed }) => ({ alignSelf: 'flex-end', paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={[styles.copyText, { color: colors.red }]}>Copy Error</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retryBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.retryText}> Try Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── ErrorBoundary Class ──

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    if (__DEV__) {
      console.warn(`[ErrorBoundary${this.props.componentName ? ` - ${this.props.componentName}` : ''}]`, error.message);
    }
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

// ── useSafeAsync hook ──

export function useSafeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): [(...args: Parameters<T>) => Promise<ReturnType<T> | null>, Error | null] {
  const [error, setError] = useState<Error | null>(null);

  const safeFn = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
      try {
        setError(null);
        return await fn(...args);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        if (__DEV__) console.warn('[useSafeAsync]', e.message);
        return null;
      }
    },
    [fn],
  );

  return [safeFn, error];
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl4,
    paddingBottom: spacing.xl5,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: radii.xl2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl4,
  },
  heading: { ...(typography.h2 as any), fontSize: 22, textAlign: 'center', marginBottom: spacing.md },
  subtitle: { ...(typography.bodySmall as any), textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl5 },
  errorBox: {
    width: '100%',
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.xl + 2,
    marginBottom: spacing.xl5,
    maxHeight: 200,
  },
  errorName: { fontSize: 11, fontWeight: '600', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  errorScroll: { maxHeight: 120 },
  errorMessage: { fontSize: 12, fontWeight: '500', marginBottom: spacing.sm },
  errorStack: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 14 },
  copyText: { fontSize: 11, fontWeight: '600' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl + 2,
    paddingHorizontal: spacing.xl5,
    borderRadius: radii.sm,
    width: '100%',
  },
  retryText: { ...(typography.button as any), fontSize: 15, color: '#FFFFFF' },
});


