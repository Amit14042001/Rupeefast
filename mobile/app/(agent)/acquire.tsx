/**
 * RupeeFast — Agent Acquire Borrowers
 *
 * Tries to fetch referral/agent data from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../src/services/dashboard';

export default function AgentAcquireScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const [referralLink] = useState('rupeefast.in/agent/SV2431');

  const { data, loading } = useAsyncData(
    async (): Promise<{ referrals: number; commission: number } | null> => {
      const result = await fetchDashboard();
      if (!result) return null;
      const agentData = result as AgentDashboardData;
      const tasks = agentData.tasks ?? [];
      const acquireTasks = tasks.filter((t: any) => t.task_type === 'acquire' || t.task_type === 'referral');
      if (acquireTasks.length === 0) return null;
      return { referrals: acquireTasks.length, commission: acquireTasks.length * 200 };
    },
    { referrals: 3, commission: 600 },
  );
  const monthReferrals = data.referrals;
  const commission = data.commission;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Acquire Borrowers</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', padding: spacing.xl4 }}>
            <View style={[styles.iconBox, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="person-add" size={32} color={colors.green} />
            </View>
            <Text style={[styles.heading, { color: colors.text }]}>Refer New Borrowers</Text>
            <Text style={[styles.subtitle, { color: colors.text3 }]}>Earn ₹200 per successful borrower referral</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.text3 }]}>Your Referral Link</Text>
            <View style={styles.codeRow}>
              <View style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.codeText, { color: colors.text }]}>{referralLink}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.copyBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                onPress={() => Alert.alert('Copied!', 'Referral link copied to clipboard.')}
              >
                <Ionicons name="copy" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={[styles.statsCard, { backgroundColor: colors.greenBg }]}>
            <View>
              <Text style={[styles.statLabel, { color: colors.text }]}>This Month</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>{monthReferrals} referrals</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.statValue, { color: colors.green }]}>₹{commission.toLocaleString('en-IN')}</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>Commission earned</Text>
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
  iconBox: { width: 70, height: 70, borderRadius: radii.xl2, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 20, fontWeight: '700', marginTop: spacing.xxl },
  subtitle: { fontSize: 13, marginTop: spacing.ssm, textAlign: 'center' },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  cardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  codeBox: { flex: 1, padding: spacing.smd, borderRadius: radii.sm, borderWidth: 1, justifyContent: 'center' },
  codeText: { fontSize: 12, fontWeight: '500' },
  copyBtn: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  statsCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, padding: spacing.xl + 2, flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontWeight: '700' },
  statSub: { fontSize: 11, marginTop: 2 },
  statValue: { fontWeight: '700' },
});
