/**
 * RupeeFast — Agent Recovery Screen
 *
 * Tries to fetch recovery tasks from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../src/services/dashboard';

interface RecoveryTask {
  initials: string;
  name: string;
  detail: string;
}

const FALLBACK_RECOVERY: RecoveryTask[] = [
  { initials: 'VO', name: 'Vikram O.', detail: '₹360 overdue · 5 days late · Sector 12' },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AgentRecoveryScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: recoveryTasks, loading } = useAsyncData(
    async (): Promise<RecoveryTask[] | null> => {
      const result = await fetchDashboard();
      if (!result) return null;
      const agentData = result as AgentDashboardData;
      const tasks = agentData.tasks ?? [];
      const recoveryItems = tasks
        .filter((t: any) => t.task_type === 'recovery')
        .map((t: any) => ({
          initials: t.borrower_name ? initials(t.borrower_name) : '??',
          name: t.borrower_name || `Borrower #${t.borrower_id || t.id}`,
          detail: t.description || 'Overdue account',
        }));
      return recoveryItems.length > 0 ? recoveryItems : null;
    },
    FALLBACK_RECOVERY,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Recovery Tasks</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.red} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.infoCard, { backgroundColor: colors.redBg }]}>
            <Ionicons name="alert-circle" size={28} color={colors.red} />
            <Text style={[styles.infoText, { color: colors.red }]}>Handle overdue accounts with ethical recovery practices</Text>
          </View>

          {recoveryTasks.map((task, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.item, { borderBottomColor: colors.borderLight }, pressed && { backgroundColor: colors.surfaceHover }]}
              onPress={() => router.push('/(agent)/recovery-detail')}
            >
              <View style={[styles.avatar, { backgroundColor: colors.redBg }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.red }}>{task.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{task.name}</Text>
                <Text style={[styles.detail, { color: colors.text3 }]}>{task.detail}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.redBg }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.red }}>Overdue</Text>
              </View>
            </Pressable>
          ))}

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
  infoCard: { margin: spacing.lg, borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center', gap: spacing.smd },
  infoText: { fontSize: 13, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 14 },
  detail: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.xs, borderRadius: radii.full },
});
