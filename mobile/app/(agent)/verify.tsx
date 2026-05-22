/**
 * RupeeFast — Agent Verification List
 *
 * Tries to fetch verification tasks from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { AgentDashboardData } from '../../src/services/dashboard';

interface VerificationItem {
  initials: string;
  name: string;
  detail: string;
}

const FALLBACK_VERIFICATIONS: VerificationItem[] = [
  { initials: 'SR', name: 'Suresh Raina', detail: 'M.G. Road · 3km · Shop owner' },
  { initials: 'NG', name: 'Neha Gupta', detail: 'Civil Lines · 5km · Salaried' },
];

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function AgentVerifyScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: verifications, loading } = useAsyncData(
    async (): Promise<VerificationItem[] | null> => {
      const result = await fetchDashboard();
      if (!result) return null;
      const agentData = result as AgentDashboardData;
      const tasks = agentData.tasks ?? [];
      const verifyItems = tasks
        .filter((t: any) => t.task_type === 'verify' || t.task_type === 'verification')
        .map((t: any) => ({
          initials: t.borrower_name ? initials(t.borrower_name) : '??',
          name: t.borrower_name || `Borrower #${t.borrower_id || t.id}`,
          detail: t.description || 'Verification pending',
        }));
      return verifyItems.length > 0 ? verifyItems : null;
    },
    FALLBACK_VERIFICATIONS,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Verifications</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {verifications.map((v, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.item, { borderBottomColor: colors.borderLight }, pressed && { backgroundColor: colors.surfaceHover }]}
              onPress={() => router.push('/(agent)/verify-detail')}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>{v.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{v.name}</Text>
                <Text style={[styles.detail, { color: colors.text3 }]}>{v.detail}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Pending</Text>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  name: { fontWeight: '600', fontSize: 14 },
  detail: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.xs, borderRadius: radii.full },
});
