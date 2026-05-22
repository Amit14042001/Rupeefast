/**
 * RupeeFast — Admin Operations Dashboard
 *
 * Layout:
 *   ┌─ Top Nav (platform title, date, settings) ───────────┐
 *   ├─ Metric Grid (Users | Loans | Disbursed | Collected) │
 *   ├─ Activity Feed (recent signups, KYC, payments) ───────┤
 *   ├─ System Health (DB, Redis, API latency) ──────────────┤
 *   └─ Bottom tab nav ──────────────────────────────────────┘
 */

import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

interface HealthItem {
  label: string;
  status: string;
  value: string;
  icon: string;
  color: string;
}

// ── Fallback platform metrics ──

const FALLBACK_METRICS = [
  { label: 'Total Users', value: '4,892', change: '+12%', icon: 'people' as const, color: '#2562A8' as const },
  { label: 'Active Loans', value: '1,247', change: '+8%',  icon: 'receipt' as const, color: '#0B6B4A' as const },
  { label: 'Disbursed',    value: '₹4.2Cr', change: '+15%', icon: 'trending-up' as const, color: '#9A6200' as const },
  { label: 'Collections',  value: '₹3.8Cr', change: '+11%', icon: 'wallet' as const, color: '#5A3E9B' as const },
];

const FALLBACK_ACTIVITIES = [
  { id: 1, type: 'user',   title: 'New user registered',     detail: 'Sneha Patel · 9876543234', time: '2m ago', icon: 'person-add' as const, color: '#2562A8' as const },
  { id: 2, type: 'kyc',    title: 'KYC submitted',           detail: 'Ravi Kumar · PAN uploaded', time: '5m ago', icon: 'shield-checkmark' as const, color: '#0B6B4A' as const },
  { id: 3, type: 'loan',   title: 'Loan disbursed',          detail: '₹8,000 → Amit S. (Daily plan)', time: '12m ago', icon: 'cash' as const, color: '#9A6200' as const },
  { id: 4, type: 'payment',title: 'Payment received',        detail: '₹120 EMI from Priya M.', time: '18m ago', icon: 'checkmark-circle' as const, color: '#0B6B4A' as const },
  { id: 5, type: 'fraud',  title: 'Suspicious login flagged', detail: 'IP mismatch · Mumbai → Delhi', time: '25m ago', icon: 'warning' as const, color: '#A02020' as const },
  { id: 6, type: 'agent',  title: 'Agent collection report',  detail: 'Sunil V. collected ₹2,400 (20/20)', time: '32m ago', icon: 'location' as const, color: '#5A3E9B' as const },
];

const FALLBACK_HEALTH: HealthItem[] = [
  { label: 'Database',    status: 'Healthy', value: '2ms',   icon: 'server', color: '#0B6B4A' },
  { label: 'Redis Cache', status: 'Healthy', value: '1ms',   icon: 'layers', color: '#0B6B4A' },
  { label: 'API Gateway', status: 'Stable',  value: '45ms',  icon: 'globe', color: '#9A6200' },
  { label: 'Queue',       status: 'Idle',    value: '0 jobs', icon: 'git-merge', color: '#2562A8' },
];



export default function AdminDashboardScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [metrics] = React.useState(FALLBACK_METRICS);
  const [activities] = React.useState(FALLBACK_ACTIVITIES);
  const [selectedDate] = React.useState(new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));

  const fetcher = useCallback(async () => {
    const result = await apiFetch<any>('/health');
    if (result.success && result.data) {
      const d = result.data;
      return [
        { label: 'Database',    status: d.database === 'connected' ? 'Healthy' : 'Degraded', value: d.database === 'connected' ? 'Online' : 'Offline', icon: 'server', color: d.database === 'connected' ? '#0B6B4A' : '#A02020' },
        { label: 'Redis Cache', status: d.redis === 'connected' ? 'Healthy' : 'Offline',   value: d.redis === 'connected' ? 'Online' : 'Disconnected', icon: 'layers', color: d.redis === 'connected' ? '#0B6B4A' : '#A02020' },
        { label: 'Uptime',      status: 'Running', value: `${Math.floor(d.uptime / 60)}m`,   icon: 'globe', color: '#2562A8' },
        { label: 'Status',      status: d.status === 'ok' ? 'Operational' : 'Degraded', value: d.status, icon: 'pulse', color: d.status === 'ok' ? '#0B6B4A' : '#9A6200' },
      ];
    }
    return null;
  }, []);

  const { data: health, loading } = useTimedAsyncData(fetcher, FALLBACK_HEALTH, 3000);

  // ── Quick action navigation ──
  const quickActions = [
    { label: 'Users', icon: 'people' as const, count: '4,892', color: '#2562A8' },
    { label: 'Loans', icon: 'receipt' as const, count: '1,247', color: '#0B6B4A' },
    { label: 'Agents', icon: 'briefcase' as const, count: '8', color: '#9A6200' },
    { label: 'Reports', icon: 'bar-chart' as const, count: 'View', color: '#5A3E9B' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Admin Panel</Text>
          <Text style={styles.topNavDate}>{selectedDate}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="settings-outline" size={22} color="#fff" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AD</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
        )}

        {/* ── Metric Cards ── */}
        <View style={styles.metricGrid}>
          {metrics.map((m, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <View style={[styles.metricIcon, { backgroundColor: `${m.color}15` }]}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={[styles.metricValue, { color: colors.text }]}>{m.value}</Text>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: colors.text3 }]}>{m.label}</Text>
                <Text style={[styles.metricChange, { color: m.color }]}>{m.change}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Quick Access</Text>
        </View>
        <View style={styles.quickActionRow}>
          {quickActions.map((action, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.quickActionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon} size={20} color={action.color} />
              </View>
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>{action.label}</Text>
              <Text style={[styles.quickActionCount, { color: action.color }]}>{action.count}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Recent Activity</Text>
          <Pressable>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>View all</Text>
          </Pressable>
        </View>

        <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {activities.map((a, i) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [
                styles.activityItem,
                { borderBottomColor: colors.borderLight },
                i === activities.length - 1 && { borderBottomWidth: 0 },
                pressed && { backgroundColor: colors.surfaceHover },
              ]}
            >
              <View style={[styles.activityIcon, { backgroundColor: `${a.color}15` }]}>
                <Ionicons name={a.icon} size={18} color={a.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.text }]}>{a.title}</Text>
                <Text style={[styles.activityDetail, { color: colors.text3 }]}>{a.detail}</Text>
              </View>
              <Text style={[styles.activityTime, { color: colors.text3 }]}>{a.time}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── System Health ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>System Health</Text>
        </View>

        <View style={styles.healthGrid}>
          {health.map((s, i) => (
            <View key={i} style={[styles.healthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.healthIconRow}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
                <Text style={[styles.healthLabel, { color: colors.text2 }]}>{s.label}</Text>
              </View>
              <Text style={[styles.healthValue, { color: colors.text }]}>{s.value}</Text>
              <View style={[styles.healthStatus, { backgroundColor: `${s.color}15` }]}>
                <View style={[styles.healthDot, { backgroundColor: s.color }]} />
                <Text style={[styles.healthStatusText, { color: s.color }]}>{s.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, gap: spacing.smd,
  },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavDate: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  metricCard: { width: '48%', borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  metricIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '800', marginTop: spacing.smd, letterSpacing: -0.5 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.ssm },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricChange: { fontSize: 11, fontWeight: '700' },
  quickActionRow: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg },
  quickActionCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, alignItems: 'center' },
  quickActionIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { fontSize: 11, fontWeight: '600', marginTop: spacing.smd },
  quickActionCount: { fontSize: 13, fontWeight: '800', marginTop: spacing.ssm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md,
  },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLink: { fontSize: 12, fontWeight: '600' },
  activityCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2, borderBottomWidth: 1 },
  activityIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  activityTitle: { fontWeight: '600', fontSize: 13 },
  activityDetail: { fontSize: 11, marginTop: 2 },
  activityTime: { fontSize: 10, fontWeight: '500' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smd, marginHorizontal: spacing.lg },
  healthCard: { width: '48%', borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  healthIconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  healthLabel: { fontSize: 12, fontWeight: '600' },
  healthValue: { fontSize: 16, fontWeight: '700', marginTop: spacing.sm },
  healthStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, marginTop: spacing.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.ssm, borderRadius: radii.full, alignSelf: 'flex-start' },
  healthDot: { width: 5, height: 5, borderRadius: 2.5 },
  healthStatusText: { fontSize: 10, fontWeight: '700' },
});
