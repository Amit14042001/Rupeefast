/**
 * RupeeFast — Agent Profile Screen (Tab)
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';
import { useAuthStore } from '../../../src/stores/auth-store';

export default function AgentProfileScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.amber }]}>
        <Text style={styles.topNavTitle}>Agent Profile</Text>
      </View>

      <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl5 }}>
          <View style={[styles.avatar, { backgroundColor: colors.amberBg }]}>
            <Text style={[styles.avatarText, { color: colors.amber }]}>SV</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>Sunil Verma</Text>
          <Text style={[styles.sub, { color: colors.text3 }]}>Agent ID: AG2431 · Zone 4</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Performance</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Rating</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>4.8 ⭐</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>Top 5% agent</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.text3 }]}>Tasks Done</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>134</Text>
            <Text style={[styles.metricSub, { color: colors.text3 }]}>This month</Text>
          </View>
        </View>

        <MenuItem icon="cash" label="My Earnings" colors={colors} onPress={() => router.push('/(agent)/earnings')} />
        <MenuItem icon="person-add" label="Acquire Borrowers" colors={colors} onPress={() => router.push('/(agent)/acquire')} />
        <MenuItem icon="trophy" label="Leaderboard" colors={colors} onPress={() => router.push('/(agent)/leaderboard')} />
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <MenuItem
          icon="log-out" label="Logout"
          labelColor={colors.red}
          colors={colors}
          onPress={() => { logout(); router.replace('/'); }}
        />

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, label, labelColor, colors, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; labelColor?: string; colors: any; onPress?: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceHover }]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: colors.amberBg }]}>
        <Ionicons name={icon} size={18} color={colors.amber} />
      </View>
      <Text style={[styles.menuLabel, { color: labelColor || colors.text }]}>{label}</Text>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.text3} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3 },
  topNavTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginTop: spacing.lg },
  sub: { fontSize: 13, marginTop: spacing.ssm },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  metricsGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginBottom: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  metricSub: { fontSize: 11, marginTop: spacing.ssm },
  divider: { height: 1, marginVertical: spacing.md, marginHorizontal: spacing.xxl },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl },
  menuIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontWeight: '600', fontSize: 14 },
});
