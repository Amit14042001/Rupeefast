/**
 * RupeeFast — Borrower Loan Offer & E-Sign Screen
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

export default function BorrowerOfferScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Your Loan Offer</Text>
      </View>

      <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', padding: spacing.xl4, paddingBottom: spacing.lg }}>
          <View style={[styles.iconBox, { backgroundColor: colors.greenBg }]}>
            <Ionicons name="file-tray" size={34} color={colors.green} />
          </View>
          <Text style={[styles.heading, { color: colors.text }]}>Loan Approved!</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>Based on your Trust Score, here's your custom offer</Text>
        </View>

        {/* Offer Summary */}
        <View style={[styles.offerCard, { backgroundColor: colors.greenBg }]}>
          <View style={styles.offerRow}>
            <View>
              <Text style={[styles.offerLabel, { color: colors.text3 }]}>Loan Amount</Text>
              <Text style={[styles.offerAmount, { color: colors.green }]}>₹8,000</Text>
            </View>
            <View style={[styles.thumbIcon, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="thumbs-up" size={24} color={colors.green} />
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          {[
            { label: 'Interest Rate', value: '20% p.a. (flat)' },
            { label: 'Processing Fee', value: '5% (₹400)' },
            { label: 'Reserve Fund', value: '5% (₹400)' },
            { label: 'Disbursal Amount', value: '₹7,200' },
            { label: 'Repayment Plan', value: 'Daily (₹120/day)' },
            { label: 'Tenure', value: '100 Days' },
          ].map((row, i) => (
            <View key={i} style={[styles.detailRow, i < 5 && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.detailLabel, { color: colors.text3 }]}>{row.label}</Text>
              <Text style={[styles.detailValue, { color: row.label === 'Disbursal Amount' ? colors.green : colors.text, fontWeight: row.label === 'Disbursal Amount' ? '700' : '600' }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* E-Sign */}
        <View style={[styles.esignCard, { borderColor: colors.primary, backgroundColor: colors.primaryBg }]}>
          <View style={[styles.esignIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="create" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.esignTitle, { color: colors.primary }]}>E-Sign Agreement</Text>
            <Text style={[styles.esignDesc, { color: colors.text2 }]}>
              By accepting, you agree to the Loan Agreement terms. An OTP will be sent to your registered mobile number.
            </Text>
          </View>
        </View>

        {/* Terms */}
        <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text style={[styles.termsTitle, { color: colors.text }]}>Terms Summary</Text>
          {[
            'AutoPay mandate will be set up for daily EMI collection',
            'Late payment fee: ₹25 per day after 24hr grace period',
            'Foreclosure allowed anytime with 0% penalty',
            'Credit Bureau reporting — timely payments boost your score',
          ].map((term, i) => (
            <View key={i} style={styles.termRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={[styles.termText, { color: colors.text2 }]}>{term}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable
          style={({ pressed }) => [styles.ctaPrimary, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setAccepted(true);
            router.push('/(borrower)/success');
          }}
        >
          <Ionicons name="create" size={16} color="#fff" />
          <Text style={styles.ctaPrimaryText}> Accept & E-Sign →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}
          onPress={() => Alert.alert('Offer Declined', 'You can re-apply anytime.')}
        >
          <Text style={[styles.ctaGhostText, { color: colors.text3 }]}>Decline Offer</Text>
        </Pressable>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  iconBox: { width: 72, height: 72, borderRadius: radii.xl2, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: spacing.xxl },
  subtitle: { fontSize: 14, marginTop: spacing.sm, textAlign: 'center' },
  offerCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, padding: spacing.xl4 },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  offerLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  offerAmount: { fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  thumbIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.smd },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13 },
  esignCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, borderWidth: 1.5, padding: spacing.xl + 2, flexDirection: 'row', gap: spacing.smd, alignItems: 'flex-start' },
  esignIcon: { width: 40, height: 40, borderRadius: radii.sm + 2, justifyContent: 'center', alignItems: 'center' },
  esignTitle: { fontWeight: '700', fontSize: 14 },
  esignDesc: { fontSize: 12, marginTop: spacing.sm, lineHeight: 18 },
  termsTitle: { fontWeight: '600', fontSize: 14, marginBottom: spacing.lg },
  termRow: { flexDirection: 'row', gap: spacing.smd, alignItems: 'flex-start', marginBottom: spacing.md },
  termText: { fontSize: 12, flex: 1, lineHeight: 18 },
  ctaPrimary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl4, paddingVertical: spacing.xl, borderRadius: radii.sm },
  ctaPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaGhost: { marginVertical: spacing.smd, marginHorizontal: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center' },
  ctaGhostText: { fontSize: 14, fontWeight: '600' },
});
