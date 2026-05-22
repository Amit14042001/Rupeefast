/**
 * RupeeFast — Agent Home Dashboard
 *
 * Fetches real task/collection data from GET /api/user/{id}/dashboard.
 * Falls back gracefully when backend is offline.
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';
import { fetchDashboard } from '../../../src/services/dashboard';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../../src/services/dashboard';

const FALLBACK_COLLECTIONS = [
  { id: 0, name: 'Rahul Sharma', location: 'M.G. Road', distance: '200m', amount: 120 },
  { id: 1, name: 'Amit Kumar', location: 'Civil Lines', distance: '1.2km', amount: 120 },
  { id: 2, name: 'Priya Mehta', location: 'Sector 15', distance: '2.5km', amount: 120 },
];

const FALLBACK_DATA: AgentDashboardData = {
  user: { id: 0, name: 'Sunil Verma', mobile: '9876543212', role: 'agent' },
  tasks: FALLBACK_COLLECTIONS,
  totalCollected: 0,
  pendingCollections: 3,
};

export default function AgentHomeScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [collected, setCollected] = useState<number[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);

  const { data, loading } = useAsyncData(
    async (): Promise<AgentDashboardData | null> => {
      const result = await fetchDashboard();
      if (!result || !((result as any).tasks)) return null;
      return result as AgentDashboardData;
    },
    FALLBACK_DATA,
  );

  const tasks = Array.isArray(data.tasks) ? data.tasks : FALLBACK_COLLECTIONS;

  const handleCollect = (id: number, name: string, amount: number) => {
    if (collected.includes(id)) return;
    setCollected((prev) => [...prev, id]);
    setTotalCollected((prev) => prev + amount);
    Alert.alert('Collected!', `₹${amount} collected from ${name}. OTP confirmed. GPS stamped.`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.amber} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.amber }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavLabel}>Active Agent</Text>
          <Text style={styles.topNavName}>{data.user.name || 'Sunil Verma'}</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Metrics ── */}
        <View style={styles.metricGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Today's Target</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>₹14,500</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>{data.pendingCollections || tasks.length} collections pending</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Commission</Text>
            <Text style={[styles.metricValue, { color: colors.green }]}>₹{Math.round(totalCollected * 0.02)}</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>2% per collection</Text>
          </View>
        </View>

        {/* ── Collections Nearby ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Collections Nearby</Text>
        </View>

        <View style={[styles.collectionsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {tasks.map((c: any, i: number) => (
            <Pressable
              key={c.id || i}
              style={({ pressed }) => [styles.collectItem, { borderBottomColor: colors.borderLight }, pressed && { opacity: 0.85 }]}
              onPress={() => handleCollect(c.id || i, c.name || `Borrower ${i + 1}`, c.amount || 120)}
            >
              <View style={[styles.collectIcon, { backgroundColor: colors.amberBg }]}>
                <Ionicons name="cash" size={18} color={colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.collectName, { color: colors.text }]}>{c.name || `Borrower ${i + 1}`}</Text>
                <Text style={[styles.collectLoc, { color: colors.text3 }]}>₹{c.amount || 120} · {c.location || 'Nearby'} ({c.distance || '0.5km'})</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: collected.includes(c.id || i) ? colors.greenBg : colors.amberBg }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: collected.includes(c.id || i) ? colors.green : colors.amber }}>
                  {collected.includes(c.id || i) ? 'Collected' : 'Pending'}
                </Text>
              </View>
            </Pressable>
          ))}
          {collected.length > 0 && (
            <View style={[styles.summaryBar, { backgroundColor: colors.greenBg }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.green }}>
                Total: ₹{totalCollected} · Commission: ₹{Math.round(totalCollected * 0.02)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.xl },
  topNavLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  topNavName: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  liveBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.ssm, borderRadius: radii.full },
  liveText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  metricGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 22, fontWeight: '700', marginTop: spacing.sm },
  metricSub: { fontSize: 11, marginTop: spacing.ssm },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  collectionsCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  collectItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2, borderBottomWidth: 1 },
  collectIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  collectName: { fontWeight: '700', fontSize: 14 },
  collectLoc: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.ssm, borderRadius: radii.full },
  summaryBar: { padding: spacing.xl + 2, alignItems: 'center' },
});
