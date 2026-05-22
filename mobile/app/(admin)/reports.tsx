/**
 * RupeeFast — Admin Reports & Analytics
 *
 * Layout:
 *   ┌─ Top Nav (title, date range) ──────────────────────┐
 *   ├─ Portfolio Summary (AUM, Loans, Default Rate, ROI) ─┤
 *   ├─ Trend Cards (Growth, Collections, Disbursals) ─────┤
 *   ├─ Chart Placeholder Sections ────────────────────────┤
 *   └─ Export actions ────────────────────────────────────┘
 */

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

interface MetricCard {
  label: string;
  value: string;
  change: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface TrendData {
  label: string;
  points: number[];
  color: string;
}

// ── Fallback data ──

const PORTFOLIO_METRICS: MetricCard[] = [
  { label: 'Total AUM', value: '₹4.2Cr', change: '+15%', icon: 'wallet', color: '#2562A8' },
  { label: 'Active Loans', value: '1,247', change: '+8%', icon: 'receipt', color: '#0B6B4A' },
  { label: 'Default Rate', value: '6.8%', change: '-2%', icon: 'shield', color: '#9A6200' },
  { label: 'Avg ROI', value: '28.5%', change: '+3%', icon: 'trending-up', color: '#5A3E9B' },
];

const TREND_METRICS: MetricCard[] = [
  { label: 'Loan Growth (MoM)', value: '+12.4%', change: 'vs +8.2% last month', icon: 'bar-chart', color: '#0B6B4A' },
  { label: 'Collection Eff.', value: '94.2%', change: '+2.1% improvement', icon: 'pulse', color: '#2562A8' },
  { label: 'Disbursals This Month', value: '₹1.2Cr', change: '324 loans disbursed', icon: 'cash', color: '#9A6200' },
  { label: 'Avg Loan Size', value: '₹8,450', change: '+5% vs last quarter', icon: 'calculator', color: '#5A3E9B' },
];

// Simple mini chart component using colored bars
function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.miniChart}>
      {data.map((v, i) => (
        <View
          key={i}
          style={[
            styles.chartBar,
            {
              height: `${(v / max) * 100}%`,
              backgroundColor: color,
              opacity: 0.4 + (i / data.length) * 0.6,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function AdminReportsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null, 1500,
  );

  const rangeOptions: { key: typeof selectedRange; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
    { key: '1y', label: '1 Year' },
  ];

  const loanTrendData: TrendData = {
    label: 'Loans Disbursed',
    points: [12, 18, 15, 22, 28, 25, 32, 30, 35, 42, 38, 45],
    color: colors.primary,
  };

  const collectionData: TrendData = {
    label: 'Collection Rate %',
    points: [88, 91, 90, 93, 92, 94, 91, 95, 96, 94, 97, 95],
    color: colors.green,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Reports & Analytics</Text>
          <Text style={styles.topNavSub}>Portfolio Performance Overview</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="download-outline" size={22} color="#fff" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Date Range Selector ── */}
      <View style={styles.rangeRow}>
        {rangeOptions.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.rangeBtn, { backgroundColor: selectedRange === opt.key ? colors.primary : colors.surface, borderColor: colors.border }]}
            onPress={() => setSelectedRange(opt.key)}
          >
            <Text style={[styles.rangeText, { color: selectedRange === opt.key ? '#fff' : colors.text2 }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : (
          <>
            {/* ── Portfolio Summary ── */}
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Portfolio Summary</Text>
            <View style={styles.metricGrid}>
              {PORTFOLIO_METRICS.map((m, i) => (
                <View key={i} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.metricIcon, { backgroundColor: `${m.color}15` }]}>
                    <Ionicons name={m.icon} size={20} color={m.color} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{m.value}</Text>
                  <View style={styles.metricRow}>
                    <Text style={[styles.metricLabel, { color: colors.text3 }]}>{m.label}</Text>
                    <Text style={[styles.metricChange, { color: m.change.startsWith('+') || m.change.startsWith('-') ? (m.change.startsWith('+') ? colors.green : m.change.startsWith('-') && m.label === 'Default Rate' ? colors.green : colors.red) : colors.text3 }]}>{m.change}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Trend Section ── */}
            <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xl4 }]}>Performance Trends</Text>

            {/* Loan Disbursal Trend */}
            <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={[styles.chartTitle, { color: colors.text }]}>Loan Disbursal Trend</Text>
                  <Text style={[styles.chartSub, { color: colors.text3 }]}>Monthly disbursals over the last 12 months</Text>
                </View>
                <Ionicons name="trending-up" size={20} color={colors.primary} />
              </View>
              <MiniChart data={loanTrendData.points} color={loanTrendData.color} />
              <View style={styles.chartLabels}>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Jan</Text>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Jun</Text>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Dec</Text>
              </View>
            </View>

            {/* Collection Rate Trend */}
            <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={[styles.chartTitle, { color: colors.text }]}>Collection Efficiency</Text>
                  <Text style={[styles.chartSub, { color: colors.text3 }]}>Monthly collection rate trend</Text>
                </View>
                <Ionicons name="pulse" size={20} color={colors.green} />
              </View>
              <MiniChart data={collectionData.points} color={collectionData.color} />
              <View style={styles.chartLabels}>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Jan</Text>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Jun</Text>
                <Text style={[styles.chartLabelText, { color: colors.text3 }]}>Dec</Text>
              </View>
            </View>

            {/* ── Trend Metric Cards ── */}
            <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xs }]}>Key Indicators</Text>
            <View style={styles.metricGrid}>
              {TREND_METRICS.map((m, i) => (
                <View key={i} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.metricIcon, { backgroundColor: `${m.color}15` }]}>
                    <Ionicons name={m.icon} size={18} color={m.color} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text, fontSize: 18 }]}>{m.value}</Text>
                  <Text style={[styles.metricChange, { color: colors.text3, fontSize: 10, fontWeight: '400', marginTop: spacing.ssm }]}>{m.change}</Text>
                </View>
              ))}
            </View>

            {/* ── Export Actions ── */}
            <View style={styles.exportSection}>
              <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Export Reports</Text>
              <View style={styles.exportRow}>
                <Pressable style={({ pressed }) => [styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exportTitle, { color: colors.text }]}>Portfolio Summary</Text>
                    <Text style={[styles.exportSub, { color: colors.text3 }]}>PDF · Includes all key metrics</Text>
                  </View>
                  <Ionicons name="download" size={18} color={colors.text3} />
                </Pressable>
                <Pressable style={({ pressed }) => [styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="grid" size={18} color={colors.amber} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exportTitle, { color: colors.text }]}>Loan Ledger</Text>
                    <Text style={[styles.exportSub, { color: colors.text3 }]}>CSV · All loan transactions</Text>
                  </View>
                  <Ionicons name="download" size={18} color={colors.text3} />
                </Pressable>
                <Pressable style={({ pressed }) => [styles.exportBtn, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="people" size={18} color={colors.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exportTitle, { color: colors.text }]}>Investor Statement</Text>
                    <Text style={[styles.exportSub, { color: colors.text3 }]}>PDF · Monthly investor report</Text>
                  </View>
                  <Ionicons name="download" size={18} color={colors.text3} />
                </Pressable>
              </View>
            </View>

            <View style={{ height: spacing.xl5 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.smd },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md },
  rangeBtn: { flex: 1, paddingVertical: spacing.lg, borderRadius: radii.xs, borderWidth: 1, alignItems: 'center' },
  rangeText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smd, marginHorizontal: spacing.lg },
  metricCard: { width: '48%', borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2 },
  metricIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '800', marginTop: spacing.smd, letterSpacing: -0.5 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.ssm },
  metricLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  metricChange: { fontSize: 11, fontWeight: '700' },
  chartCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartTitle: { fontSize: 15, fontWeight: '700' },
  chartSub: { fontSize: 11, marginTop: 2 },
  miniChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4, marginTop: spacing.xl4, paddingHorizontal: spacing.sm },
  chartBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, paddingHorizontal: spacing.sm },
  chartLabelText: { fontSize: 9, fontWeight: '500' },
  exportSection: { marginTop: spacing.sm },
  exportRow: { gap: spacing.smd, marginHorizontal: spacing.lg },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, padding: spacing.xl + 2, borderRadius: radii.xs, borderWidth: 1 },
  exportTitle: { fontSize: 13, fontWeight: '600' },
  exportSub: { fontSize: 10, marginTop: 2 },
});
