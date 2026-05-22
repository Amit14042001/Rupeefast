/**
 * RupeeFast — Investor Home Dashboard
 *
 * Fetches real portfolio data from GET /api/user/{id}/dashboard.
 * Falls back gracefully when backend is offline.
 */

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import type { InvestorDashboardData } from '../../src/services/dashboard';

const FALLBACK_DATA: InvestorDashboardData = {
  user: { id: 0, name: 'Anita Sharma', mobile: '9876543211', role: 'investor' },
  investments: [
    { id: 1, investor_id: 0, amount: 32000, borrower_name: 'SAFE Bucket', status: 'active', returns: 4480 },
    { id: 2, investor_id: 0, amount: 13200, borrower_name: 'MODERATE Bucket', status: 'active', returns: 2904 },
  ],
  totalEarned: 1455,
  totalInvested: 45200,
};

export default function InvestorHomeScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InvestorDashboardData>(FALLBACK_DATA);

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

  const roi = data.totalInvested > 0 ? ((data.totalEarned / data.totalInvested) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.green }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavLabel}>Portfolio Value</Text>
          <Text style={styles.topNavAmount}>₹{data.totalInvested.toLocaleString('en-IN')}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.notifBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(investor)/notifications' as any)}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(data.user.name || 'AS').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Hero Card ── */}
        <LinearGradient colors={[colors.green, colors.greenLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <Text style={styles.heroLabel}>Interest Earned (May)</Text>
          <Text style={styles.heroAmount}>₹{data.totalEarned.toLocaleString('en-IN')}</Text>
          <View style={styles.heroCtaRow}>
            <Pressable
              style={({ pressed }) => [styles.heroCta, styles.heroCtaPrimary, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(investor)/invest' as any)}
            >
              <Text style={styles.heroCtaText}>Invest More</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.heroCta, styles.heroCtaSecondary, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(investor)/withdraw' as any)}
            >
              <Text style={[styles.heroCtaText, { color: '#fff' }]}>Withdraw</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ── Metric Grid ── */}
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Annual ROI</Text>
            <Text style={[styles.metricValue, { color: colors.green }]}>{roi}%</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>3.2% higher than Avg.</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Live Loans</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>92</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>Diversified portfolio</Text>
          </View>
        </View>

        {/* ── Section Header ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Active Portfolios</Text>
        </View>

        {/* ── Portfolio items from API ── */}
        {(data.investments ?? []).map((inv, i) => (
          <Pressable
            key={inv.id || i}
            style={({ pressed }) => [styles.portfolioCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: i === 0 ? colors.green : colors.amber }, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/(investor)/portfolio' as any)}
          >
            <View style={styles.portfolioRow}>
              <View>
                <Text style={[styles.portfolioName, { color: i === 0 ? colors.green : colors.amber }]}>{inv.borrower_name}</Text>
                <Text style={[styles.portfolioSub, { color: colors.text3 }]}>₹{inv.amount.toLocaleString('en-IN')} invested</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.portfolioRoi, { color: colors.text }]}>₹{inv.returns} returns</Text>
                <Text style={[styles.portfolioDefault, { color: i === 0 ? colors.green : colors.amber }]}>{inv.status}</Text>
              </View>
            </View>
          </Pressable>
        ))}

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.xl },
  topNavLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  topNavAmount: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  notifBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  heroCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.xl, padding: spacing.xl4, position: 'relative', overflow: 'hidden' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmount: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: spacing.sm, letterSpacing: -0.5 },
  heroCtaRow: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.xl4 },
  heroCta: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  heroCtaPrimary: { backgroundColor: '#fff' },
  heroCtaText: { fontSize: 12, fontWeight: '700', color: '#0B6B4A' },
  heroCtaSecondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.15)' },
  metricGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 22, fontWeight: '700', marginTop: spacing.sm },
  metricSub: { fontSize: 11, marginTop: spacing.ssm },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  portfolioCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, borderLeftWidth: 4, padding: spacing.xl + 2, marginBottom: spacing.smd },
  portfolioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  portfolioName: { fontWeight: '700', fontSize: 14 },
  portfolioSub: { fontSize: 12, marginTop: 2 },
  portfolioRoi: { fontWeight: '700', fontSize: 14 },
  portfolioDefault: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
