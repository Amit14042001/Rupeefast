/**
 * RupeeFast — Borrower Trust Score Details Screen
 *
 * Fetches real credit score from GET /api/credit/score.
 * Falls back to mock factors when backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchCreditScore } from '../../src/services/credit';
import { useAsyncData } from '../../src/hooks/useAsyncData';

const FALLBACK_FACTORS = [
  { label: 'UPI Transaction History', score: 85, weight: 'High', icon: 'phone-portrait' as const },
  { label: 'Income Consistency', score: 72, weight: 'High', icon: 'trending-up' as const },
  { label: 'Repayment History', score: 90, weight: 'High', icon: 'checkmark-circle' as const },
  { label: 'SIM Age & GPS Stability', score: 68, weight: 'Medium', icon: 'navigate' as const },
  { label: 'Device Fingerprint', score: 95, weight: 'Medium', icon: 'shield' as const },
  { label: 'Bank Statement Analysis', score: 70, weight: 'Medium', icon: 'wallet' as const },
  { label: 'Existing EMIs', score: 55, weight: 'Low', icon: 'card' as const },
];

const TIPS = [
  'Maintain consistent UPI transactions',
  'Keep your SIM active & GPS on',
  'Pay EMIs on time every day',
  'Reduce existing debt burden',
];

export default function BorrowerScoreScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [factors] = useState(FALLBACK_FACTORS);

  const { data: score, loading } = useAsyncData(
    async (): Promise<number | null> => {
      const result = await fetchCreditScore();
      return (result.success && result.score) ? result.score : null;
    },
    74,
  );

  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Trust Score</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', padding: spacing.xl4 }}>
            {/* Animated Ring */}
            <View style={{ width: size, height: size, position: 'relative', marginBottom: spacing.lg }}>
              <Svg width={size} height={size}>
                <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.borderLight} strokeWidth={strokeWidth} />
                <Circle
                  cx={size / 2} cy={size / 2} r={radius} fill="none"
                  stroke={colors.primary} strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              </Svg>
              <View style={styles.ringText}>
                <Text style={[styles.ringScore, { color: colors.primary }]}>{score}</Text>
                <Text style={[styles.ringLabel, { color: colors.text3 }]}>/ 100</Text>
              </View>
            </View>
            <Text style={[styles.scoreLevel, { color: colors.primary }]}>{score >= 90 ? 'Gold' : score >= 75 ? 'Silver' : 'Bronze'} Tier</Text>
            <Text style={[styles.scoreNext, { color: colors.text3 }]}>Next: {score >= 90 ? 'Platinum at 95' : score >= 75 ? 'Gold at 90' : 'Silver at 75'} points</Text>

            {/* Score Factors */}
            <Text style={[styles.sectionTitle, { color: colors.text3, alignSelf: 'flex-start', marginTop: spacing.xl4 }]}>Score Factors</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '100%' }]}>
              {factors.map((factor, i) => (
                <View key={i} style={[styles.factorRow, i < factors.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <Ionicons name={factor.icon} size={16} color={colors.text3} />
                  <View style={{ flex: 1, marginLeft: spacing.smd }}>
                    <Text style={[styles.factorLabel, { color: colors.text }]}>{factor.label}</Text>
                    <Text style={[styles.factorWeight, { color: colors.text3 }]}>Weight: {factor.weight}</Text>
                  </View>
                  <View style={[styles.factorScore, { backgroundColor: factor.score >= 70 ? colors.greenBg : factor.score >= 50 ? colors.amberBg : colors.redBg }]}>
                    <Text style={[styles.factorScoreText, { color: factor.score >= 70 ? colors.green : factor.score >= 50 ? colors.amber : colors.red }]}>{factor.score}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Tips */}
            <Text style={[styles.sectionTitle, { color: colors.text3, alignSelf: 'flex-start', marginTop: spacing.xl4 }]}>Improvement Tips</Text>
            <View style={[styles.tipsCard, { backgroundColor: colors.primaryBg, width: '100%' }]}>
              {TIPS.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons name="bulb" size={16} color={colors.primary} />
                  <Text style={[styles.tipText, { color: colors.text2 }]}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: spacing.xl5 }} />
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
  scroll: { flex: 1 },
  ringText: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  ringScore: { fontSize: 36, fontWeight: '800' },
  ringLabel: { fontSize: 12, fontWeight: '500' },
  scoreLevel: { fontSize: 18, fontWeight: '700' },
  scoreNext: { fontSize: 12, marginTop: spacing.xs },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  factorRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  factorLabel: { fontSize: 13, fontWeight: '500' },
  factorWeight: { fontSize: 10, marginTop: 1 },
  factorScore: { width: 32, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  factorScoreText: { fontSize: 12, fontWeight: '700' },
  tipsCard: { borderRadius: radii.sm, padding: spacing.xl + 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, marginBottom: spacing.lg },
  tipText: { fontSize: 12, flex: 1 },
});
