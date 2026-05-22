/**
 * RupeeFast — Input Component
 *
 * Form input with label, error state, icon prefix, and helper text.
 *
 * @example
 *   <Input
 *     label="Mobile Number"
 *     value={mobile}
 *     onChangeText={setMobile}
 *     keyboardType="number-pad"
 *     maxLength={10}
 *     error={errorMessage}
 *     left={<Text>+91</Text>}
 *   />
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../theme';

// ── Types ──

export interface InputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /** Label shown above the input */
  label?: string;
  /** Error message (shows red outline + message below) */
  error?: string;
  /** Helper text shown below the input */
  helper?: string;
  /** Left-side element (icon or country-code prefix) */
  left?: React.ReactNode;
  /** Right-side element (e.g., clear button) */
  right?: React.ReactNode;
  /** Show clear icon when value is non-empty */
  clearable?: boolean;
  /** Container style override */
  containerStyle?: StyleProp<ViewStyle>;
}

// ═══════════════════════════════════════════════════
//  INPUT COMPONENT
// ═══════════════════════════════════════════════════

export default function Input({
  label,
  error,
  helper,
  left,
  right,
  clearable = false,
  value,
  onChangeText,
  containerStyle,
  ...textInputProps
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChangeText?.('');
  }, [onChangeText]);

  const borderColor = error
    ? colors.red
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={containerStyle as any}>
      {/* Label */}
      {label && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: error ? colors.red : colors.text2,
            marginBottom: spacing.md,
          }}
        >
          {label}
        </Text>
      )}

      {/* Input wrapper */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderColor,
          borderRadius: radii.xs,
          paddingHorizontal: spacing.xxl - 2,
          height: 56,
          backgroundColor: error ? colors.redBg : colors.surface,
        }}
      >
        {/* Left element (country code, icon) */}
        {left && (
          <View style={{ marginRight: spacing.lg }}>{left}</View>
        )}

        {/* Actual TextInput */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.text3}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            typography.body,
            {
              flex: 1,
              fontSize: 17,
              fontWeight: '600',
              color: colors.text,
              height: '100%',
              paddingVertical: 0,
            },
          ]}
          {...textInputProps}
        />

        {/* Right element (clear, eye toggle, etc.) */}
        {clearable && value && typeof value === 'string' && value.length > 0 ? (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => ({
              padding: spacing.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="close-circle" size={18} color={colors.text3} />
          </Pressable>
        ) : right ? (
          <View style={{ marginLeft: spacing.smd }}>{right}</View>
        ) : null}
      </View>

      {/* Error message */}
      {error && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.sm,
          }}
        >
          <Ionicons name="alert-circle" size={12} color={colors.red} />
          <Text
            style={{
              fontSize: 11,
              color: colors.red,
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {/* Helper text */}
      {helper && !error && (
        <Text
          style={{
            fontSize: 11,
            color: colors.text3,
            marginTop: spacing.sm,
          }}
        >
          {helper}
        </Text>
      )}
    </View>
  );
}
