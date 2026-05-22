/**
 * RupeeFast — OTP Verification Screen
 *
 * 4-digit OTP entry with:
 * - Individual digit inputs with auto-advance
 * - Auto-submit when all 4 digits entered
 * - Resend timer
 * - Back navigation to login
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useAuthStore } from '../../src/stores/auth-store';
import { verifyOtp, sendOtp } from '../../src/services/auth';
import { demoLogin } from '../../src/services/auth';

const OTP_LENGTH = 6;
const RESEND_DELAY = 30; // seconds

export default function OtpScreen() {
  const router = useRouter();
  const { role, mobile } = useLocalSearchParams<{ role: string; mobile: string }>();
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ── Resend countdown ──
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // ── Verify handler ──
  const handleVerify = useCallback(async () => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) return;

    setIsLoading(true);

    // Try real OTP verification
    const result = await verifyOtp(mobile, code);

    setIsLoading(false);

    if (result.success) {
      // Navigate to role-specific home
      switch (role) {
        case 'borrower':
          router.replace('/(borrower)/(tabs)/home');
          break;
        case 'investor':
          router.replace('/(investor)/home');
          break;
        case 'agent':
          router.replace('/(agent)/home');
          break;
        default:
          router.replace('/');
      }
    } else if (result.error === 'Network error') {
      // Offline/demo mode — use demo login if not already logged in
      if (!user) {
        demoLogin(mobile, role as any);
      }
      switch (role) {
        case 'borrower':
          router.replace('/(borrower)/(tabs)/home');
          break;
        case 'investor':
          router.replace('/(investor)/home');
          break;
        case 'agent':
          router.replace('/(agent)/home');
          break;
        default:
          router.replace('/');
      }
    } else {
      Alert.alert('Verification Failed', result.error || 'Invalid OTP');
    }
  }, [otp, mobile, role, user, router]);

  // Stable ref so auto-submit effect never goes stale
  const verifyRef = useRef(handleVerify);
  verifyRef.current = handleVerify;

  // Auto-submit when all digits filled
  useEffect(() => {
    if (otp.every((d) => d.length === 1)) {
      verifyRef.current();
    }
  }, [otp]);

  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      const digit = text.replace(/\D/g, '').slice(0, 1);
      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [otp],
  );



  const handleResend = useCallback(async () => {
    setResendTimer(RESEND_DELAY);
    setOtp(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    // Try real OTP resend
    if (mobile) {
      await sendOtp(mobile, role as any);
    }
  }, [mobile, role]);

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
        <View style={{ width: 36 }} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.heading, { color: colors.text }]}>
          Enter verification code
        </Text>
        <Text style={[styles.subText, { color: colors.text2 }]}>
          We've sent a 4-digit OTP to{' '}
          <Text style={{ fontWeight: '600' }}>
            +91 {user?.mobile?.replace(/(\d{5})(\d{5})/, '$1 $2')}
          </Text>
        </Text>

        {/* OTP input row */}
        <View style={styles.otpRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              style={[
                styles.otpInput,
                {
                  borderColor: otp[i] ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
                otp[i] && {
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 3,
                },
              ]}
              keyboardType="number-pad"
              maxLength={1}
              value={otp[i]}
              onChangeText={(t) => handleDigitChange(t, i)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, i)
              }
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={[styles.resendText, { color: colors.text3 }]}>
              Resend in {resendTimer}s
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text
                style={[styles.resendLink, { color: colors.primary }]}
              >
                Resend OTP
              </Text>
            </Pressable>
          )}
        </View>

        {/* Verify button (manual fallback) */}
        <Pressable
          style={({ pressed }) => [
            styles.verifyBtn,
            { backgroundColor: colors.primary },
            pressed && styles.verifyBtnPressed,
            (isLoading || otp.join('').length !== OTP_LENGTH) && {
              opacity: 0.5,
            },
          ]}
          onPress={handleVerify}
          disabled={isLoading || otp.join('').length !== OTP_LENGTH}
        >
          <Text style={styles.verifyBtnText}>
            {isLoading ? 'Verifying...' : 'Verify'}
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
    lineHeight: 20,
    marginBottom: spacing.xl5,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: spacing.xl5,
  },
  otpInput: {
    width: 56,
    height: 60,
    borderRadius: radii.xs,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: spacing.xl5,
  },
  resendText: {
    ...typography.bodySmall,
  },
  resendLink: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  verifyBtn: {
    paddingVertical: spacing.xl + 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  verifyBtnText: {
    ...typography.button,
    color: '#FFFFFF',
  },
});
