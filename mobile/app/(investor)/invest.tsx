/**
 * RupeeFast — Investor Deploy Capital Screen
 *
 * Tries to fetch dashboard data on mount for user context.
 * Falls back to mock calculations when backend is offline.
 */

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import type { InvestorDashboardData } from '../../src/services/dashboard';

type RiskStrategy = 'safe' | 'balanced';

export default function InvestScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const [amount, setAmount] = useState(10000);
  const [strategy, setStrategy] = useState<RiskStrategy>('safe');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InvestorDashboardData | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDashboard().then((result) => {
      if (!mounted) return;
      if (result) {
        const inv = result as any;
        if (inv.investments !== undefined) {
          setData(result as InvestorDashboardData);
        }
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const borrowersCount = Math.max(1, Math.floor(amount / 500));
  const monthlyReturn = Math.round(amount * (strategy === 'safe' ? 0.01167 : 0.01833));
  const riskPercent = Math.round((500 / amount) * 100);
  const roi = strategy === 'safe' ? 14 : 22;
  const defaultRate = strategy === 'safe' ? 0.2 : 1.5;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Deploy Capital</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* User balance from API / fallback */}
          {data && (
            <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}>
              <Text style={[styles.topNavLabel, { color: colors.text3 }]}>
                Available Balance: <Text style={{ fontWeight: '700', color: colors.green }}>₹{data.totalInvested.toLocaleString('en-IN')}</Text>
              </Text>
            </View>
          )}

          {/* Amount */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: data ? spacing.smd : spacing.lg }]}>
            <View style={styles.amountHeader}>
              <Text style={[styles.amountLabel, { color: colors.text }]}>Investment Amount</Text>
              <Text style={[styles.amountValue, { color: colors.green }]}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
            <Slider
              style={{ width: '100%', height: 40, marginTop: spacing.lg }}
              minimumValue={5000}
              maximumValue={100000}
              step={5000}
              value={amount}
              onValueChange={setAmount}
              minimumTrackTintColor={colors.green}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.green}
            />
            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderLabel, { color: colors.text3 }]}>₹5,000</Text>
              <Text style={[styles.sliderLabel, { color: colors.text3 }]}>₹1,00,000</Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.breakdown}>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.text3 }]}>Total Investment</Text>
                <Text style={[styles.breakdownValue, { color: colors.text }]}>₹{amount.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.text3 }]}>Distribution</Text>
                <Text style={[styles.breakdownValue, { color: colors.text }]}>{borrowersCount} borrowers × ₹500</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.text3 }]}>Monthly Return ({roi}% ROI)</Text>
                <Text style={[styles.breakdownValue, { color: colors.green }]}>₹{monthlyReturn.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.text3 }]}>Max Risk</Text>
                <Text style={[styles.breakdownValue, { color: colors.amber }]}>Only ₹500 at risk ({riskPercent}%)</Text>
              </View>
            </View>
          </View>

          {/* Risk Strategy */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Choose Risk Strategy</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.strategyCard, { backgroundColor: colors.surface, borderColor: strategy === 'safe' ? colors.green : colors.border, borderLeftColor: colors.green },
              strategy === 'safe' && { borderColor: colors.green },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => setStrategy('safe')}
          >
            <View style={styles.strategyHeader}>
              <Text style={[styles.strategyName, { color: colors.green }]}>SAFE ({roi}% ROI)</Text>
              {strategy === 'safe' && (
                <View style={[styles.checkCircle, { backgroundColor: colors.green }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.strategyDesc, { color: colors.text3 }]}>
              Lends only to "Silver" level borrowers with Trust Score {'>'} 85.
            </Text>
            <Text style={[styles.strategyDefaultRate, { color: colors.green }]}>Default Rate: {defaultRate}%</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.strategyCard, { backgroundColor: colors.surface, borderColor: strategy === 'balanced' ? colors.amber : colors.border, borderLeftColor: colors.amber },
              strategy === 'balanced' && { borderColor: colors.amber },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => setStrategy('balanced')}
          >
            <View style={styles.strategyHeader}>
              <Text style={[styles.strategyName, { color: colors.amber }]}>BALANCED ({strategy === 'balanced' ? 22 : 22}% ROI)</Text>
              {strategy === 'balanced' && (
                <View style={[styles.checkCircle, { backgroundColor: colors.amber }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.strategyDesc, { color: colors.text3 }]}>
              Lends to "Bronze" & "Silver" level borrowers with Trust Score {'>'} 70.
            </Text>
            <Text style={[styles.strategyDefaultRate, { color: colors.amber }]}>Default Rate: {defaultRate}%</Text>
          </Pressable>

          {/* Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.greenBg }]}>
            <View style={{ flexDirection: 'row', gap: spacing.smd, alignItems: 'center' }}>
              <Ionicons name="shield-checkmark" size={24} color={colors.green} />
              <Text style={[styles.infoText, { color: colors.green }]}>
                RupeeFast Reserve Fund covers up to 100% of the principal for SAFE bucket investments.
              </Text>
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Alert.alert(
                'Deployment Scheduled',
                `₹${amount.toLocaleString('en-IN')} will be deployed across ${borrowersCount} verified borrowers by tomorrow 9 AM.`,
              );
            }}
          >
            <Ionicons name="lock-closed" size={14} color="#fff" />
            <Text style={styles.ctaText}> Confirm Investment</Text>
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
  topNavLabel: { fontSize: 13, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  amountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  amountLabel: { fontSize: 14, fontWeight: '600' },
  amountValue: { fontSize: 22, fontWeight: '800' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  sliderLabel: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, marginVertical: spacing.lg },
  breakdown: { gap: spacing.md },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: 13 },
  breakdownValue: { fontWeight: '600', fontSize: 13 },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  strategyCard: {
    marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderLeftWidth: 4,
    padding: spacing.xl + 2, marginBottom: spacing.smd,
  },
  strategyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strategyName: { fontWeight: '700', fontSize: 15 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  strategyDesc: { fontSize: 12, marginTop: spacing.ssm },
  strategyDefaultRate: { fontSize: 11, fontWeight: '600', marginTop: spacing.ssm },
  infoCard: { marginHorizontal: spacing.lg, marginTop: spacing.xxl, borderRadius: radii.sm, padding: spacing.xl + 2 },
  infoText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  cta: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: spacing.lg, marginTop: spacing.xl4,
    paddingVertical: spacing.xl + 4, borderRadius: radii.sm,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
