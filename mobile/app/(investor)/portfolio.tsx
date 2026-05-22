/**
 * RupeeFast — Investor Portfolio Detail
 *
 * Fetches real portfolio data from GET /api/user/{id}/dashboard.
 * Falls back to mock data when backend is offline.
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import type { InvestorDashboardData } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';

const MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const FALLBACK_BARS = [60, 80, 95, 110, 130, 140];

const FALLBACK_DATA: InvestorDashboardData = {
  user: { id: 0, name: 'Anita Sharma', mobile: '9876543211', role: 'investor' },
  investments: [
    { id: 1, investor_id: 0, amount: 32000, borrower_name: 'SAFE Bucket', status: 'active', returns: 4480 },
    { id: 2, investor_id: 0, amount: 13200, borrower_name: 'MODERATE Bucket', status: 'active', returns: 2904 },
  ],
  totalEarned: 1455,
  totalInvested: 45200,
};

export default function PortfolioScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const fetcher = useCallback(async () => {
    const result = await fetchDashboard();
    if (!result) return null;
    const inv = result as any;
    return inv.investments !== undefined ? (result as InvestorDashboardData) : null;
  }, []);

  const { data, loading } = useAsyncData(fetcher, FALLBACK_DATA);

  const totalInvested = data.totalInvested;
  const totalEarned = data.totalEarned;
  const investments = data.investments ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Portfolio Detail</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient colors={[colors.green, colors.greenLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <Text style={styles.heroLabel}>Portfolio Value</Text>
            <Text style={styles.heroAmount}>₹{totalInvested.toLocaleString('en-IN')}</Text>
            <View style={styles.heroStats}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>₹{totalEarned.toLocaleString('en-IN')}</Text>
                <Text style={styles.heroStatLabel}>This Month</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>
                  {totalInvested > 0 ? ((totalEarned / totalInvested) * 100).toFixed(1) : '0.0'}%
                </Text>
                <Text style={styles.heroStatLabel}>Annual ROI</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>{investments.length}</Text>
                <Text style={styles.heroStatLabel}>Buckets</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Bar Chart - approximate from investment data */}
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Portfolio Growth (Est.)</Text>
              <Text style={[styles.chartBadge, { color: colors.green, borderColor: colors.green }]}>6M</Text>
            </View>
            <View style={styles.chartBars}>
              {MONTHS.map((month, i) => {
                const lastBar = i === MONTHS.length - 1;
                const barHeight = investments.length > 0
                  ? Math.max(40, Math.round((totalInvested * (0.6 + i * 0.08)) / 500))
                  : FALLBACK_BARS[i];
                return (
                  <View key={month} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.min(barHeight, 180),
                          backgroundColor: lastBar ? colors.greenLight : colors.greenBg,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, { color: lastBar ? colors.text : colors.text3 }]}>{month}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Allocation Breakdown */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Allocation Breakdown</Text>
          </View>

          {investments.length === 0 && (
            <View style={[styles.allocCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.allocName, { color: colors.text2, textAlign: 'center' }]}>No active investments</Text>
            </View>
          )}
          {investments.map((inv, i) => {
            const pct = totalInvested > 0 ? ((inv.amount / totalInvested) * 100).toFixed(1) : '0';
            const bucketColor = i === 0 ? colors.green : colors.amber;
            const roi = inv.amount > 0 ? ((inv.returns / inv.amount) * 100).toFixed(0) : '0';
            return (
              <View key={inv.id || i} style={[styles.allocCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.allocRow}>
                  <View style={[styles.allocDot, { backgroundColor: bucketColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.allocName, { color: colors.text }]}>{inv.borrower_name}</Text>
                    <Text style={[styles.allocSub, { color: colors.text3 }]}>₹{inv.amount.toLocaleString('en-IN')} · {pct}%</Text>
                  </View>
                  <Text style={[styles.allocRoi, { color: bucketColor }]}>{roi}% ROI</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: (Number(pct) + '%') as any, backgroundColor: bucketColor }]} />
                </View>
              </View>
            );
          })}

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>Default Rate</Text>
              <Text style={[styles.statValue, { color: colors.amber }]}>0.8%</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>Industry avg: 3.2%</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.text3 }]}>Avg Per Bucket</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                ₹{investments.length > 0 ? Math.round(totalInvested / investments.length).toLocaleString('en-IN') : '0'}
              </Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>Across {investments.length} buckets</Text>
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
  scrollContent: { paddingBottom: 64 },
  heroCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.xl, padding: spacing.xl4, alignItems: 'center' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: spacing.sm },
  heroStats: { flexDirection: 'row', gap: spacing.xl4, marginTop: spacing.xl4, alignItems: 'center' },
  heroStatValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  chartCard: { marginHorizontal: spacing.lg, marginTop: spacing.smd, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl4 },
  chartTitle: { fontSize: 13, fontWeight: '700' },
  chartBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, borderWidth: 1 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, height: 140 },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.ssm },
  bar: { width: '100%', borderRadius: radii.sm, minHeight: 4 },
  barLabel: { fontSize: 9, fontWeight: '600' },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  allocCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  allocDot: { width: 10, height: 10, borderRadius: spacing.sm },
  allocName: { fontWeight: '600', fontSize: 13 },
  allocSub: { fontSize: 11, marginTop: 2 },
  allocRoi: { fontWeight: '700', fontSize: 13 },
  progressBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: radii.full },
  progressFill: { height: '100%', borderRadius: radii.full },
  statsGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  statCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  statSub: { fontSize: 11, marginTop: spacing.ssm },
});
