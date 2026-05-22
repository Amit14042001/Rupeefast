/**
 * RupeeFast — Borrower EMI Schedule Tab
 *
 * Full payment schedule with day-by-day breakdown,
 * payment status indicators, and summary stats.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../../src/theme';
import { fetchDashboard } from '../../../src/services/dashboard';
import type { BorrowerDashboardData } from '../../../src/services/dashboard';
import { useAsyncData } from '../../../src/hooks/useAsyncData';

interface ScheduleDay {
  day: number;
  amount: number;
  due: Date;
  status: 'paid' | 'pending' | 'upcoming' | 'missed';
  paidOn?: Date;
}

function generateFallbackSchedule(): ScheduleDay[] {
  const schedule: ScheduleDay[] = [];
  for (let i = 0; i < 100; i++) {
    const due = new Date();
    due.setDate(due.getDate() + i - 32);
    let status: ScheduleDay['status'];
    if (i < 30) status = 'paid';
    else if (i < 33) status = 'pending';
    else status = 'upcoming';
    schedule.push({ day: i + 1, amount: 120, due, status });
  }
  return schedule;
}

function repaymentsToSchedule(repayments: BorrowerDashboardData['recentRepayments']): ScheduleDay[] {
  return (repayments ?? []).slice(0, 100).map((r, i) => ({
    day: i + 1,
    amount: r.amount,
    due: new Date(r.due_date || Date.now()),
    status: r.paid ? 'paid' as const : 'pending' as const,
  }));
}

export default function BorrowScheduleScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'upcoming'>('all');

  const fetcher = useCallback(async () => {
    const result = await fetchDashboard();
    if (result && (result as BorrowerDashboardData).recentRepayments) {
      return repaymentsToSchedule((result as BorrowerDashboardData).recentRepayments);
    }
    return null;
  }, []);

  const { data: schedule, loading } = useAsyncData(fetcher, generateFallbackSchedule());

  const totalPaid = schedule.filter((s) => s.status === 'paid').reduce((a, s) => a + s.amount, 0);
  const totalPending = schedule.filter((s) => s.status === 'pending' || s.status === 'missed').reduce((a, s) => a + s.amount, 0);
  const daysPaid = schedule.filter((s) => s.status === 'paid').length;

  const filtered = filter === 'all' ? schedule : schedule.filter((s) => s.status === filter);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Nav */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Repayment Schedule</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.statValue, { color: colors.green }]}>₹{totalPaid.toLocaleString('en-IN')}</Text>
            <Text style={[styles.statLabel, { color: colors.text3 }]}>Paid</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.amberBg }]}>
            <Text style={[styles.statValue, { color: colors.amber }]}>₹{totalPending.toLocaleString('en-IN')}</Text>
            <Text style={[styles.statLabel, { color: colors.text3 }]}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{daysPaid}/100</Text>
            <Text style={[styles.statLabel, { color: colors.text3 }]}>Days Paid</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'paid', 'pending', 'upcoming'] as const).map((f) => (
            <Pressable
              key={f}
              style={({ pressed }) => [
                styles.filterBtn,
                {
                  backgroundColor: filter === f ? colors.primary : colors.surface,
                  borderColor: filter === f ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, { color: filter === f ? '#fff' : colors.text3, fontWeight: filter === f ? '700' : '500' }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Schedule List */}
        <View style={[styles.scheduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {filtered.length === 0 && (
            <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle" size={40} color={colors.green} />
              <Text style={[typography.body, { color: colors.text2, marginTop: spacing.lg }]}>
                No {filter} payments
              </Text>
            </View>
          )}
          {filtered.map((entry, i) => {
            const statusColors = {
              paid: { bg: colors.greenBg, text: colors.green, icon: 'checkmark-circle' as const },
              pending: { bg: colors.amberBg, text: colors.amber, icon: 'time-outline' as const },
              upcoming: { bg: colors.borderLight, text: colors.text3, icon: 'calendar-outline' as const },
              missed: { bg: colors.redBg, text: colors.red, icon: 'alert-circle' as const },
            };
            const sc = statusColors[entry.status];
            return (
              <View key={i} style={[styles.scheduleItem, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.dayBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.dayText, { color: sc.text }]}>D{entry.day}</Text>
                </View>
                <View style={styles.scheduleBody}>
                  <Text style={[styles.scheduleAmount, { color: colors.text }]}>₹{entry.amount}</Text>
                  <Text style={[styles.scheduleDate, { color: colors.text3 }]}>
                    {entry.due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Ionicons name={sc.icon} size={14} color={sc.text} />
                  <Text style={[styles.statusText, { color: sc.text }]}>
                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                  </Text>
                </View>
              </View>
            );
          })}
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
  topNavTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.smd, padding: spacing.lg },
  statCard: { flex: 1, borderRadius: radii.sm, padding: spacing.xl + 2, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: spacing.ssm, textTransform: 'uppercase' },
  filterRow: { flexDirection: 'row', gap: spacing.smd, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  filterBtn: { paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.smd, borderRadius: radii.full, borderWidth: 1 },
  filterText: { fontSize: 12 },
  scheduleCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2, gap: spacing.lg },
  dayBadge: { width: 44, height: 32, borderRadius: radii.sm, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: 11, fontWeight: '700' },
  scheduleBody: { flex: 1 },
  scheduleAmount: { fontSize: 15, fontWeight: '700' },
  scheduleDate: { fontSize: 11, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.full },
  statusText: { fontSize: 10, fontWeight: '600' },
});
