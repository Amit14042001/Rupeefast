/**
 * RupeeFast — Agent Earnings Screen
 *
 * Tries to fetch agent earnings data from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../src/services/dashboard';

interface EarningsBreakdown {
  total: number;
  month: number;
  coll: number;
  ver: number;
  acq: number;
  rec: number;
}

const FALLBACK_EARNINGS: EarningsBreakdown = {
  total: 12450,
  month: 3240,
  coll: 8200,
  ver: 2250,
  acq: 1400,
  rec: 600,
};

export default function AgentEarningsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const earningsData = useAsyncData(
    async (): Promise<EarningsBreakdown | null> => {
      const result = await fetchDashboard();
      if (!result) return null;
      const agentData = result as AgentDashboardData;
      const tasks = agentData.tasks ?? [];
      const collAmt = tasks.filter((t: any) => t.task_type === 'collect').length * 100;
      const verAmt = tasks.filter((t: any) => t.task_type === 'verify').length * 50;
      const acqAmt = tasks.filter((t: any) => t.task_type === 'acquire').length * 200;
      const recAmt = tasks.filter((t: any) => t.task_type === 'recovery').length * 150;
      const total = collAmt + verAmt + acqAmt + recAmt;
      if (total === 0) return null;
      return { total, month: total, coll: collAmt, ver: verAmt, acq: acqAmt, rec: recAmt };
    },
    FALLBACK_EARNINGS,
  );
  const { loading } = earningsData;
  const e = earningsData.data;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>My Earnings</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.heroLabel, { color: colors.text3 }]}>Total Earnings</Text>
            <Text style={[styles.heroAmount, { color: colors.green }]}>₹{e.total.toLocaleString('en-IN')}</Text>
            <Text style={[styles.heroSub, { color: colors.text2 }]}>This month: ₹{e.month.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Collections</Text>
              <Text style={[styles.metricValue, { color: colors.green }]}>₹{e.coll.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>Tasks at ₹100</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Verifications</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>₹{e.ver.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>Tasks at ₹50</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Acquisitions</Text>
              <Text style={[styles.metricValue, { color: colors.purple }]}>₹{e.acq.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>Referrals at ₹200</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Recovery</Text>
              <Text style={[styles.metricValue, { color: colors.amber }]}>₹{e.rec.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>5% commission</Text>
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
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  heroCard: { margin: spacing.lg, borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center' },
  heroLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmount: { fontSize: 36, fontWeight: '800', marginTop: spacing.sm },
  heroSub: { fontSize: 12, marginTop: spacing.ssm },
  metricsGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginBottom: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  metricSub: { fontSize: 11, marginTop: spacing.ssm },
});
