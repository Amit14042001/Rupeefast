/**
 * RupeeFast — Login Screen
 *
 * Mobile number entry with:
 * - Country code prefix (+91)
 * - 10-digit numeric input with auto-format
 * - Send OTP button with validation
 * - Back button to landing
 * - Handles borrower, investor, and agent roles via route param
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, typography, spacing, radii } from '../../src/theme';
import { sendOtp, demoLogin } from '../../src/services/auth';
import type { UserRole } from '../../src/types';

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  const [mobile, setMobile] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleLabel =
    role === 'borrower'
      ? 'Borrow Money'
      : role === 'investor'
        ? 'Invest & Earn'
        : 'Field Agent';

  const handleSendOTP = useCallback(async () => {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);

    // Try real OTP send first
    const result = await sendOtp(cleaned, role as UserRole);

    if (result.success) {
      // OTP sent — navigate to OTP screen with mobile number
      setIsLoading(false);
      router.push(`/(auth)/otp?role=${role}&mobile=${cleaned}`);
    } else if (result.error === 'Network error') {
      // Offline/demo mode — create demo user and navigate
      demoLogin(cleaned, role as UserRole);
      setIsLoading(false);
      router.push(`/(auth)/otp?role=${role}&mobile=${cleaned}`);
    } else {
      setIsLoading(false);
      Alert.alert('Error', result.error || 'Failed to send OTP');
    }
  }, [mobile, role, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: top + spacing.smd }]}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: 'rgba(27,58,107,0.1)' },
            pressed && styles.backBtnPressed,
          ]}
          onPress={handleBack}
        >
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>
          {roleLabel}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.heading, { color: colors.text }]}>
          Enter your mobile number
        </Text>
        <Text style={[styles.subText, { color: colors.text2 }]}>
          We'll send a 6-digit OTP to verify your number
        </Text>

        {/* Mobile input */}
        <View style={[styles.inputRow, { borderColor: colors.border }]}>
          <Text style={[styles.countryCode, { color: colors.text }]}>+91</Text>
          <View
            style={[styles.divider, { backgroundColor: colors.border }]}
          />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="98765 43210"
            placeholderTextColor={colors.text3}
            keyboardType="number-pad"
            maxLength={10}
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0, 10))}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSendOTP}
          />
        </View>

        {/* Send OTP button */}
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: colors.primary },
            pressed && styles.sendBtnPressed,
            isLoading && { opacity: 0.7 },
          ]}
          onPress={handleSendOTP}
          disabled={isLoading}
        >
          <Text style={styles.sendBtnText}>
            {isLoading ? 'Sending OTP...' : 'Send OTP'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  backBtnText: {
    fontSize: 20,
    color: '#1B3A6B',
  },
  topBarTitle: {
    ...typography.h3,
    fontSize: 17,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl4,
    paddingTop: spacing.xl5,
  },
  heading: {
    ...typography.h2,
    fontSize: 24,
    marginBottom: spacing.md,
  },
  subText: {
    ...typography.bodySmall,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: spacing.xl5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.xxl - 2,
    height: 56,
  },
  countryCode: {
    ...typography.body,
    fontWeight: '600',
    fontSize: 17,
    marginRight: spacing.lg,
  },
  divider: {
    width: 1,
    height: 28,
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    height: '100%',
  },
  sendBtn: {
    marginTop: spacing.xl4,
    paddingVertical: spacing.xl + 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  sendBtnText: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
