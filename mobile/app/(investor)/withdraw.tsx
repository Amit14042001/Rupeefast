/**
 * RupeeFast — Investor Withdraw Screen
 *
 * Tries to fetch investor dashboard data on mount for the available balance.
 * Falls back to ₹45,200 when the backend is offline.
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';

export default function WithdrawScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [amount, setAmount] = useState(5000);
  const [availableBalance, setAvailableBalance] = useState(45200);

  const fetcher = useCallback(async () => {
    const result = await fetchDashboard();
    if (!result) return null;
    const inv = result as any;
    if (inv.totalInvested !== undefined) {
      const earnings = inv.totalEarnings ?? Math.round(inv.totalInvested * 0.14);
      setAvailableBalance(inv.totalInvested + earnings);
      return true;
    }
    return null;
  }, []);

  const { loading } = useAsyncData(fetcher, false as boolean);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Withdraw Funds</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl5, paddingHorizontal: spacing.xxl }}>
            <View style={[styles.iconBox, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="cash" size={32} color={colors.green} />
            </View>
            <Text style={[styles.heading, { color: colors.text }]}>Withdraw to Bank</Text>
            <Text style={[styles.subtitle, { color: colors.text3 }]}>
              Available balance:{' '}
              <Text style={{ fontWeight: '700', color: colors.green }}>
                ₹{availableBalance.toLocaleString('en-IN')}
              </Text>
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.amountHeader}>
              <Text style={[styles.amountLabel, { color: colors.text }]}>Withdrawal Amount</Text>
              <Text style={[styles.amountValue, { color: colors.green }]}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40, marginTop: spacing.lg }}
              minimumValue={1000}
              maximumValue={Math.max(1000, availableBalance)}
              step={1000}
              value={amount}
              onValueChange={setAmount}
              minimumTrackTintColor={colors.green}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.green}
            />
            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderLabel, { color: colors.text3 }]}>₹1,000</Text>
              <Text style={[styles.sliderLabel, { color: colors.text3 }]}>
                ₹{availableBalance.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Transfer To</Text>
          </View>

          <View style={[styles.bankCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.green }]}>
            <Ionicons name="business" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bankName, { color: colors.text }]}>State Bank of India</Text>
              <Text style={[styles.bankAcc, { color: colors.text3 }]}>XXXX-XXXX-4821 · Savings</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.greenBg }]}>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 13, color: colors.text }}>Withdrawal Amount</Text>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                ₹{amount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 13, color: colors.text }}>Processing Time</Text>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>1-2 business days</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ fontSize: 13, color: colors.text }}>Withdrawal Fee</Text>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.green }}>Free</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
            onPress={() =>
              Alert.alert(
                'Withdrawal Initiated',
                `₹${amount.toLocaleString('en-IN')} will be credited to SBI account within 1-2 business days.`,
              )
            }
          >
            <Text style={styles.ctaText}>Withdraw ₹{amount.toLocaleString('en-IN')}</Text>
          </Pressable>

          <View style={{ height: spacing.xl5 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  iconBox: { width: 70, height: 70, borderRadius: radii.xl2, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: spacing.xxl },
  subtitle: { fontSize: 14, marginTop: spacing.ssm },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  amountLabel: { fontSize: 14, fontWeight: '600' },
  amountValue: { fontSize: 22, fontWeight: '800' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  sliderLabel: { fontSize: 11, fontWeight: '600' },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  bankCard: {
    marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderLeftWidth: 3,
    padding: spacing.xl + 2, flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
  },
  bankName: { fontWeight: '600', fontSize: 14 },
  bankAcc: { fontSize: 12, marginTop: 2 },
  summaryCard: { marginHorizontal: spacing.lg, marginTop: spacing.xxl, borderRadius: radii.sm, padding: spacing.xl + 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.ssm },
  cta: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl4,
    paddingVertical: spacing.xl + 4, borderRadius: radii.sm, alignItems: 'center',
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
