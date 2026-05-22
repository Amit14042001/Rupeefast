/**
 * RupeeFast — Borrower KYC Verification Screen
 *
 * Fetches KYC status from GET /api/kyc/status on mount.
 * Falls back to mock steps when backend is offline.
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { getKycStatus } from '../../src/services/kyc';
import { useAsyncData } from '../../src/hooks/useAsyncData';

const MOCK_STEPS = [
  { icon: 'checkmark', label: 'Aadhaar eKYC', desc: 'OTP-based verification', done: true },
  { icon: 'checkmark', label: 'PAN Verification', desc: 'Cross-check with income tax records', done: true },
  { icon: 'checkmark', label: 'Selfie Liveness Check', desc: 'AI-powered anti-spoofing', done: true },
  { icon: 'refresh', label: 'AI Credit Scoring', desc: '47 signals analyzed in real-time', done: false },
];

export default function BorrowerKycScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const fetcher = useCallback(async () => {
    const result = await getKycStatus();
    return result.status;
  }, []);

  const { data: kycStatus, loading } = useAsyncData<'none' | 'pending' | 'verified' | 'rejected'>(
    fetcher,
    'none',
  );

  // Build active steps based on API status
  const steps = (() => {
    if (kycStatus === 'none') return MOCK_STEPS;
    const baseSteps = [
      { icon: 'checkmark', label: 'Aadhaar eKYC', desc: 'OTP-based verification', done: true },
      { icon: 'checkmark', label: 'PAN Verification', desc: 'Cross-check with income tax records', done: true },
      { icon: 'checkmark', label: 'Selfie Liveness Check', desc: 'AI-powered anti-spoofing', done: true },
      { icon: 'refresh', label: 'AI Credit Scoring', desc: '47 signals analyzed in real-time', done: kycStatus === 'verified' },
    ];
    return baseSteps;
  })();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>KYC Verification</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
            {/* Status banner */}
            {kycStatus !== 'none' && (
              <View style={[styles.statusBanner, { backgroundColor: kycStatus === 'verified' ? colors.greenBg : kycStatus === 'rejected' ? colors.redBg : colors.amberBg, marginBottom: spacing.lg }]}>
                <Ionicons name={kycStatus === 'verified' ? 'shield-checkmark' : kycStatus === 'rejected' ? 'close-circle' : 'time'} size={20} color={kycStatus === 'verified' ? colors.green : kycStatus === 'rejected' ? colors.red : colors.amber} />
                <Text style={[styles.statusText, { color: kycStatus === 'verified' ? colors.green : kycStatus === 'rejected' ? colors.red : colors.amber }]}>
                  {kycStatus === 'verified' ? 'KYC Verified ✓' : kycStatus === 'rejected' ? 'KYC Rejected — Re-submit' : 'KYC Under Review'}
                </Text>
              </View>
            )}

            <View style={[styles.iconBox, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.heading, { color: colors.text }]}>Identity Verification</Text>
            <Text style={[styles.subtitle, { color: colors.text3 }]}>
              We need to verify your identity and assess your creditworthiness using our AI engine.
            </Text>

            <View style={[styles.stepsCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              {steps.map((step, i) => (
                <View key={i} style={[styles.stepRow, i < steps.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }]}>
                  <View style={[styles.stepIcon, { backgroundColor: step.done ? colors.greenBg : colors.primaryBg }]}>
                    <Ionicons name={step.icon as any} size={14} color={step.done ? colors.green : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepLabel, { color: colors.text }]}>{step.label}</Text>
                    <Text style={[styles.stepDesc, { color: colors.text3 }]}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {kycStatus !== 'verified' && (
              <Pressable
                style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/(borrower)/ai-score')}
              >
                <Text style={styles.ctaText}>Start AI Assessment →</Text>
              </Pressable>
            )}

            {kycStatus === 'verified' && (
              <Pressable
                style={({ pressed }) => [styles.cta, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/(borrower)/(tabs)/home')}
              >
                <Text style={styles.ctaText}>Back to Home</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, paddingVertical: spacing.smd, paddingHorizontal: spacing.xl, borderRadius: radii.sm, width: '100%' },
  statusText: { fontSize: 13, fontWeight: '600' },
  iconBox: { width: 70, height: 70, borderRadius: radii.xl2, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: spacing.xxl },
  subtitle: { fontSize: 14, marginTop: spacing.sm, textAlign: 'center', lineHeight: 20 },
  stepsCard: { width: '100%', borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.xl4 },
  stepRow: { flexDirection: 'row', gap: spacing.smd, alignItems: 'flex-start', paddingVertical: spacing.lg },
  stepIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontWeight: '600', fontSize: 13 },
  stepDesc: { fontSize: 12, marginTop: 2 },
  cta: { width: '100%', marginTop: spacing.xl4, paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
