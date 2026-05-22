/**
 * RupeeFast — Borrower Home Dashboard
 *
 * Fetches real data from GET /api/user/{id}/dashboard.
 * Falls back to mock data when backend is offline.
 */

import { useCallback, useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import {
  default as Svg,
  Circle,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../../src/theme';
import { fetchDashboard } from '../../../src/services/dashboard';
import type { Repayment } from '../../../src/types';
import type { BorrowerDashboardData } from '../../../src/services/dashboard';
import { useAsyncData } from '../../../src/hooks/useAsyncData';

// ── Fallback mock data (when backend is offline) ──

function generateFallbackRepayments(): Repayment[] {
  const entries: Repayment[] = [];
  for (let i = 0; i < 10; i++) {
    const paid = i < 5;
    entries.push({
      id: i + 1,
      loan_id: 1,
      due_date: `Day ${i + 1}`,
      amount: 120,
      paid,
      type: 'daily',
    });
  }
  return entries;
}

const FALLBACK_DATA: BorrowerDashboardData = {
  user: { id: 0, name: 'Ramesh Kumar', mobile: '9876543210', role: 'borrower' },
  activeLoan: undefined,
  recentRepayments: generateFallbackRepayments(),
  loanBalance: 8700,
  repaidAmount: 4300,
  trustScore: 74,
  dailyLimit: 12000,
};

// ══════════════════════════════════════════════════════
// TRUST SCORE ANIMATED RING
// ══════════════════════════════════════════════════════

function TrustScoreRing({ score, size = 70 }: { score: number; size?: number }) {
  const { colors } = useTheme();
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    let rafId: number;

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentOffset = circumference - eased * circumference;
      setOffset(currentOffset);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [score, circumference]);

  const ringColor = score >= 75 ? colors.green : score >= 50 ? colors.amber : colors.red;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={[styles.ringScoreText, { color: ringColor }]}>{score}</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════
// SCHEDULE ITEM
// ══════════════════════════════════════════════════════

function ScheduleListItem({ entry, index }: { entry: Repayment; index: number }) {
  const { colors } = useTheme();
  const isPaid = entry.paid;
  const iconBgColor = isPaid ? colors.greenBg : colors.amberBg;
  const iconColor = isPaid ? colors.green : colors.amber;
  const iconName = isPaid ? 'checkmark-circle' : 'time-outline';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.scheduleItem,
        { borderBottomColor: colors.borderLight },
        index === 0 && { borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },
        pressed && { backgroundColor: colors.surfaceHover, paddingLeft: 20 },
      ]}
    >
      <View style={[styles.scheduleIcon, { backgroundColor: iconBgColor }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.scheduleBody}>
        <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
          {entry.due_date}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.text2 }]}>
          EMI Collection
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[typography.metric, { color: colors.text, fontSize: 16 }]}>
          ₹{entry.amount}
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: isPaid ? colors.green : colors.amber,
              fontSize: 10,
              textTransform: 'none' as const,
            },
          ]}
        >
          {isPaid ? 'Paid' : 'Pending'}
        </Text>
      </View>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════
// QUICK ACTION BUTTON
// ══════════════════════════════════════════════════════

type QuickActionDef = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  iconColor: string;
  route: string;
};

const QUICK_ACTIONS: QuickActionDef[] = [
  { label: 'Apply', icon: 'add', bgColor: '#EBF2FB', iconColor: '#1B3A6B', route: '/(tabs)/apply' },
  { label: 'History', icon: 'timer-outline', bgColor: '#E3F5EE', iconColor: '#0B6B4A', route: '/history' },
  { label: 'Offers', icon: 'gift', bgColor: '#F0EBFF', iconColor: '#5A3E9B', route: '/offers-list' },
  { label: 'Help', icon: 'chatbubbles', bgColor: '#FEF3DC', iconColor: '#9A6200', route: '/help' },
  { label: 'Refer', icon: 'share', bgColor: '#E3F5EE', iconColor: '#0B6B4A', route: '/refer' },
];

function QuickActionButton({
  label,
  icon,
  bgColor,
  iconColor,
  text2Color,
  onPress,
}: QuickActionDef & { text2Color: string; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        pressed && { transform: [{ scale: 0.92 }] },
      ]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.quickActionLabel2, { color: text2Color }]}>{label}</Text>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ══════════════════════════════════════════════════════

export default function BorrowerHomeScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const fetcher = useCallback(async () => {
    const result = await fetchDashboard();
    return result ? (result as BorrowerDashboardData) : null;
  }, []);

  const { data, loading } = useAsyncData(fetcher, FALLBACK_DATA);

  const { loanBalance, repaidAmount, trustScore, dailyLimit } = data;
  const recentRepayments = data.recentRepayments ?? [];
  const totalLoan = loanBalance + repaidAmount;
  const progressPct = totalLoan > 0 ? Math.round((repaidAmount / totalLoan) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Navigation ── */}
      <View
        style={[
          styles.topNav,
          {
            paddingTop: top + spacing.smd,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavGreeting}>Welcome back,</Text>
          <Text style={styles.topNavName}>{data.user.name || 'Ramesh Kumar'}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.notifButton,
            pressed && { opacity: 0.7, transform: [{ scale: 0.9 }] },
          ]}
          onPress={() => router.push('/(borrower)/notifications' as any)}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(data.user.name || 'RK').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}
        />
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card ── */}
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroOrb1} />
          <View style={styles.heroOrb2} />

          <Text style={styles.heroLabel}>Active Loan Balance</Text>
          <View style={styles.heroAmountRow}>
            <Text style={styles.heroCurrency}>₹</Text>
            <Text style={styles.heroAmount}>
              {loanBalance.toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.heroProgressBg}>
            <View style={[styles.heroProgressFill, { width: `${progressPct}%` }]} />
          </View>

          <View style={styles.heroProgressLabels}>
            <Text style={styles.heroProgressText}>
              ₹{repaidAmount.toLocaleString('en-IN')} repaid
            </Text>
            <Text style={styles.heroProgressText}>{100 - progressPct}% remaining</Text>
          </View>

          {/* Pay CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.heroCta,
              pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => router.push('/(borrower)/pay' as any)}
          >
            <Text style={styles.heroCtaText}>Pay Today</Text>
          </Pressable>
        </LinearGradient>

        {/* ── Metric Grid ── */}
        <View style={styles.metricGrid}>
          <Pressable
            style={({ pressed }) => [
              styles.metricCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { borderColor: colors.text3, transform: [{ translateY: -1 }] },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>
              TRUST SCORE
            </Text>
            <View style={styles.metricRow}>
              <TrustScoreRing score={trustScore} size={56} />
              <View style={{ marginLeft: spacing.lg }}>
                <Text style={[styles.metricValue, { color: colors.green }]}>
                  {trustScore}
                  <Text style={[styles.metricUnit, { color: colors.text3 }]}>
                    {' '}/ 100
                  </Text>
                </Text>
                <Text style={[styles.metricSub, { color: colors.text3 }]}>
                  Level: {trustScore >= 90 ? 'Gold 🥇' : trustScore >= 75 ? 'Silver 🥈' : 'Bronze 🥉'}
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.metricCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { borderColor: colors.text3, transform: [{ translateY: -1 }] },
            ]}
          >
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>
              DAILY LIMIT
            </Text>
            <Text style={[styles.metricValue, { color: colors.primary, marginTop: spacing.sm }]}>
              ₹{dailyLimit.toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.metricSub, { color: colors.text3, marginTop: spacing.sm }]}>
              Next: {dailyLimit >= 20000 ? 'Platinum 💎' : dailyLimit >= 15000 ? 'Gold 🥇' : 'Silver 🥈'}
            </Text>
          </Pressable>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>
            Quick Actions
          </Text>
        </View>
        <View
          style={[
            styles.quickActionsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <QuickActionButton
                key={action.label}
                {...action}
                text2Color={colors.text2}
                onPress={() => router.push(`/(borrower)${action.route}` as any)}
              />
            ))}
          </View>
        </View>

        {/* ── Upcoming Collections ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>
            Upcoming Collections
          </Text>
          <Pressable onPress={() => router.push('/(borrower)/(tabs)/schedule' as any)}>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>
              See all
            </Text>
          </Pressable>
        </View>
        <View
          style={[
            styles.scheduleCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {recentRepayments.slice(0, 5).map((entry: any, i: number) => (
            <ScheduleListItem key={i} entry={entry} index={i} />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3,
    gap: spacing.xl,
    position: 'relative',
    zIndex: 10,
  },
  topNavGreeting: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2, fontWeight: '500' },
  topNavName: { fontFamily: 'Inter', fontSize: 18, fontWeight: '700', color: '#fff' },
  notifButton: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  heroCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.xl, padding: spacing.xl4 - 2, position: 'relative', overflow: 'hidden' },
  heroOrb1: { position: 'absolute', top: -80, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroOrb2: { position: 'absolute', bottom: -60, left: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  heroCurrency: { fontSize: 16, fontWeight: '600', color: '#fff' },
  heroAmount: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroProgressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: spacing.xl4 - 4, overflow: 'hidden' },
  heroProgressFill: { height: '100%', backgroundColor: '#4ADE80', borderRadius: 3 },
  heroProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  heroProgressText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  heroCta: { marginTop: spacing.xl4 - 4, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl4, borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', alignSelf: 'flex-start' },
  heroCtaText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  metricGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, padding: spacing.xl, borderWidth: 1 },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  metricValue: { fontSize: 22, fontWeight: '700' },
  metricUnit: { fontSize: 12, fontWeight: '400' },
  metricSub: { fontSize: 11, marginTop: 6 },
  ringScoreText: { fontSize: 18, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionLink: { fontSize: 12, fontWeight: '600' },
  quickActionsCard: { marginHorizontal: spacing.lg, borderRadius: radii.xl, borderWidth: 1, paddingVertical: spacing.md },
  quickActionsGrid: { flexDirection: 'row' },
  quickAction: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  quickActionIcon: { width: 48, height: 48, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel2: { fontSize: 11, fontWeight: '500' },
  scheduleCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2, borderBottomWidth: 1 },
  scheduleIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  scheduleBody: { flex: 1, minWidth: 0 },
});
