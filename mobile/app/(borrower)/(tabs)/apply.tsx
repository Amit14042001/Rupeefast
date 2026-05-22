/**
 * RupeeFast — Borrower Loan Application Screen
 *
 * Posts loan application to POST /api/loans/apply on submit.
 * Falls back gracefully when backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';
import { applyLoan } from '../../../src/services/loans';
import type { LoanPlan } from '../../../src/types';

const PURPOSES = ['Business Expansion', 'Emergency Cash', 'Education', 'Medical', 'Home Renovation'];
const PLANS = [
  { id: 0, name: 'Daily Micro-Payments', desc: '/ day for 100 days', planType: 'Daily' as LoanPlan, amount: 120, receive: 7200, total: 12000 },
  { id: 1, name: 'Weekly Payment', desc: '/ week for ~3 months', planType: 'Weekly' as LoanPlan, amount: 630, receive: 7400, total: 11800 },
  { id: 2, name: 'Monthly Payment', desc: '/ month for 1 month', planType: 'Monthly' as LoanPlan, amount: 9440, receive: 7400, total: 9440 },
];

export default function BorrowerApplyScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState(8000);
  const [purpose, setPurpose] = useState(0);
  const [plan, setPlan] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fee = Math.round(amount * 0.05);
  const recv = amount - fee - Math.round(amount * 0.05);
  const daily = Math.round((amount * 1.2) / 100);
  const weekly = Math.round((amount * 1.18) / 15);

  const handleSubmit = async () => {
    setSubmitting(true);
    const selectedPlan = PLANS[plan];
    const result = await applyLoan(amount, selectedPlan.planType, PURPOSES[purpose]);

    if (result.success) {
      router.push('/(borrower)/kyc');
    } else {
      // Fallback: proceed to KYC anyway (backend may be offline)
      Alert.alert('Note', 'Running in offline mode. Proceeding with verification.');
      router.push('/(borrower)/kyc');
    }
    setSubmitting(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primary }]}>
        <Text style={styles.topNavTitle}>Apply for Loan</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Eligibility */}
        <View style={[styles.eligibilityCard, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.eligLabel, { color: colors.primary }]}>Maximum Eligibility</Text>
          <Text style={[styles.eligAmount, { color: colors.primary }]}>₹12,000</Text>
          <Text style={[styles.eligSub, { color: colors.text2 }]}>Based on your Trust Score of 74</Text>
        </View>

        {/* Amount */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.amountHeader}>
            <Text style={[styles.amountLabel, { color: colors.text }]}>Loan Amount</Text>
            <Text style={[styles.amountValue, { color: colors.primary }]}>₹{amount.toLocaleString('en-IN')}</Text>
          </View>
          <Slider
            style={{ width: '100%', height: 40, marginTop: spacing.lg }}
            minimumValue={2000} maximumValue={12000} step={500} value={amount}
            onValueChange={setAmount}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary}
          />
          <View style={styles.sliderLabels}>
            <Text style={[styles.sliderLabel, { color: colors.text3 }]}>₹2,000</Text>
            <Text style={[styles.sliderLabel, { color: colors.text3 }]}>₹12,000</Text>
          </View>
        </View>

        {/* Purpose */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Select Purpose</Text>
        </View>
        <View style={styles.purposeGrid}>
          {PURPOSES.map((p, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.purposeBtn,
                { backgroundColor: purpose === i ? colors.primaryBg : colors.surface, borderColor: purpose === i ? colors.primary : colors.border },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setPurpose(i)}
            >
              <Text style={[styles.purposeText, { color: purpose === i ? colors.primary : colors.text2 }]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* Plans */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Repayment Plan</Text>
        </View>

        {PLANS.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [
              styles.planCard,
              { backgroundColor: colors.surface, borderColor: plan === p.id ? colors.primary : colors.border },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => setPlan(p.id)}
          >
            <View style={[styles.check, { borderColor: plan === p.id ? colors.primary : colors.border, backgroundColor: plan === p.id ? colors.primary : 'transparent' }]}>
              {plan === p.id && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planName, { color: colors.text }]}>{p.name}</Text>
              <Text style={[styles.planDesc, { color: colors.text3 }]}>
                ₹{p.id === 0 ? daily : p.id === 1 ? weekly : p.amount}{p.desc}
              </Text>
              <Text style={[styles.planRecv, { color: colors.text2 }]}>You receive: ₹{recv.toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.planTotal, { color: colors.green }]}>₹{p.total.toLocaleString('en-IN')}</Text>
              <Text style={[styles.planTotalLabel, { color: colors.text3 }]}>Total Pay</Text>
            </View>
          </Pressable>
        ))}

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.summaryTitle, { color: colors.primary }]}>Loan Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text2 }]}>Loan Amount</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>₹{amount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text2 }]}>Processing Fee (5%)</Text>
            <Text style={[styles.summaryVal, { color: colors.red }]}>-₹{fee.toLocaleString('en-IN')}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={[styles.summaryLabel, { color: colors.text2 }]}>You Receive</Text>
            <Text style={[styles.summaryTotal, { color: colors.green }]}>₹{recv.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text2 }]}>Daily Payment</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>₹{daily}/day</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : pressed ? 0.85 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Proceed to Verification →</Text>
          )}
        </Pressable>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3 },
  topNavTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  eligibilityCard: { margin: spacing.lg, borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center' },
  eligLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  eligAmount: { fontSize: 32, fontWeight: '800', marginTop: spacing.sm },
  eligSub: { fontSize: 11, marginTop: spacing.sm },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  amountLabel: { fontSize: 14, fontWeight: '600' },
  amountValue: { fontSize: 22, fontWeight: '800' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  sliderLabel: { fontSize: 11, fontWeight: '600' },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smd, paddingHorizontal: spacing.lg },
  purposeBtn: { paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.lg, borderRadius: radii.sm, borderWidth: 1.5 },
  purposeText: { fontWeight: '600', fontSize: 12 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  planName: { fontWeight: '700', fontSize: 14 },
  planDesc: { fontSize: 12, marginTop: 2 },
  planRecv: { fontSize: 11, marginTop: 2 },
  planTotal: { fontWeight: '700' },
  planTotalLabel: { fontSize: 11 },
  summaryCard: { marginHorizontal: spacing.lg, marginTop: spacing.xxl, borderRadius: radii.sm, padding: spacing.xl + 2 },
  summaryTitle: { fontWeight: '700', fontSize: 13, marginBottom: spacing.smd },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.ssm },
  summaryLabel: { fontSize: 13 },
  summaryVal: { fontWeight: '600', fontSize: 13 },
  summaryTotalRow: { borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: spacing.md, marginTop: spacing.sm },
  summaryTotal: { fontWeight: '700', fontSize: 16 },
  cta: { marginHorizontal: spacing.lg, marginTop: spacing.xl4, paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
