/**
 * RupeeFast — Agent Tasks Dashboard
 *
 * Tries to fetch agent tasks from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';
import { fetchDashboard } from '../../../src/services/dashboard';
import { useAsyncData } from '../../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../../src/services/dashboard';

type TaskSection = { title: string; count: number; color: string; items: TaskItem[] };
type TaskItem = { name: string; detail: string; route: string; badge: string; badgeColor: string; icon: string };

const FALLBACK_TASK_SECTIONS: TaskSection[] = [
  {
    title: 'Verifications', count: 2, color: 'blue',
    items: [
      { name: 'New Borrower: Suresh R.', detail: 'Location verification pending · 3km away', route: '/(agent)/verify', badge: 'Verify', badgeColor: 'blue', icon: 'id-card' },
      { name: 'New Borrower: Neha G.', detail: 'Residence check pending · 5km away', route: '/(agent)/verify', badge: 'Verify', badgeColor: 'blue', icon: 'id-card' },
    ],
  },
  {
    title: 'Collections', count: 3, color: 'amber',
    items: [
      { name: 'Rahul Sharma', detail: '₹120 · M.G. Road (200m)', route: '/(agent)/collection-log?loanId=1&borrowerName=Rahul+Sharma', badge: 'Collect', badgeColor: 'amber', icon: 'cash' },
      { name: 'Amit Kumar', detail: '₹120 · Civil Lines (1.2km)', route: '/(agent)/collection-log?loanId=2&borrowerName=Amit+Kumar', badge: 'Collect', badgeColor: 'amber', icon: 'cash' },
    ],
  },
  {
    title: 'Recovery', count: 1, color: 'red',
    items: [
      { name: 'Overdue: Vikram O.', detail: '₹360 overdue · 5 days late', route: '/(agent)/recovery', badge: 'Recover', badgeColor: 'red', icon: 'alert-triangle' },
    ],
  },
];

const iconBgMap: Record<string, string> = { blue: '#EBF2FB', amber: '#FEF3DC', red: '#FDEAEA' };
const iconColorMap: Record<string, string> = { blue: '#1B3A6B', amber: '#9A6200', red: '#A02020' };
const badgeBgMap: Record<string, string> = { blue: '#EBF2FB', amber: '#FEF3DC', red: '#FDEAEA' };
const badgeColorMap: Record<string, string> = { blue: '#1B3A6B', amber: '#9A6200', red: '#A02020' };

function deriveSectionsFromTasks(tasks: any[]): TaskSection[] {
  const sections: TaskSection[] = [];

  const verifyTasks = tasks.filter((t: any) => t.task_type === 'verify' || t.task_type === 'verification');
  if (verifyTasks.length > 0) {
    sections.push({
      title: 'Verifications', count: verifyTasks.length, color: 'blue',
      items: verifyTasks.map((t: any) => ({
        name: t.borrower_name || `Borrower #${t.borrower_id || t.id}`,
        detail: t.description || 'Location verification pending',
        route: '/(agent)/verify',
        badge: 'Verify', badgeColor: 'blue', icon: 'id-card',
      })),
    });
  }

  const collectTasks = tasks.filter((t: any) => t.task_type === 'collect' || t.task_type === 'collection');
  if (collectTasks.length > 0) {
    sections.push({
      title: 'Collections', count: collectTasks.length, color: 'amber',
      items: collectTasks.map((t: any) => ({
        name: t.borrower_name || `Borrower #${t.borrower_id || t.id}`,
        detail: t.description || `₹${t.amount || 120} to collect`,
        route: `/(agent)/collection-log?loanId=${t.id || ''}&borrowerName=${encodeURIComponent(t.borrower_name || 'Borrower')}`,
        badge: 'Collect', badgeColor: 'amber', icon: 'cash',
      })),
    });
  }

  const recoveryTasks = tasks.filter((t: any) => t.task_type === 'recovery');
  if (recoveryTasks.length > 0) {
    sections.push({
      title: 'Recovery', count: recoveryTasks.length, color: 'red',
      items: recoveryTasks.map((t: any) => ({
        name: t.borrower_name || `Borrower #${t.borrower_id || t.id}`,
        detail: t.description || 'Overdue account',
        route: '/(agent)/recovery',
        badge: 'Recover', badgeColor: 'red', icon: 'alert-triangle',
      })),
    });
  }

  return sections;
}

export default function AgentTasksScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: sections, loading } = useAsyncData(
    async (): Promise<TaskSection[] | null> => {
      const result = await fetchDashboard();
      if (!result) return null;
      const agentData = result as AgentDashboardData;
      const tasks = agentData.tasks ?? [];
      if (tasks.length === 0) return null;
      const derived = deriveSectionsFromTasks(tasks);
      return derived.length > 0 ? derived : null;
    },
    FALLBACK_TASK_SECTIONS,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.amber }]}>
        <Text style={styles.topNavTitle}>All Tasks</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {sections.map((section, si) => (
            <View key={si}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text3 }]}>{section.title} ({section.count})</Text>
              </View>
              {section.items.map((item, ii) => (
                <Pressable
                  key={ii}
                  style={({ pressed }) => [styles.taskItem, { borderBottomColor: colors.borderLight }, pressed && { backgroundColor: colors.surfaceHover }]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.taskIcon, { backgroundColor: iconBgMap[section.color] }]}>
                    <Ionicons name={item.icon as any} size={18} color={iconColorMap[section.color]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.taskDetail, { color: colors.text3 }]}>{item.detail}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badgeBgMap[section.color] }]}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: badgeColorMap[section.color] }}>{item.badge}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={{ height: spacing.xl5 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3 },
  topNavTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1 },
  taskIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  taskName: { fontWeight: '600', fontSize: 14 },
  taskDetail: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.xs, borderRadius: radii.full },
});
