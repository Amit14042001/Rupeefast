/**
 * RupeeFast — Agent Recovery Detail
 */

import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

export default function AgentRecoveryDetailScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Recovery Detail</Text>
      </View>

      <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.xl4 }}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.redBg }]}>
              <Text style={[styles.avatarText, { color: colors.red }]}>VO</Text>
            </View>
            <View>
              <Text style={[styles.profileName, { color: colors.text }]}>Vikram O.</Text>
              <Text style={[styles.profileSub, { color: colors.text3 }]}>+91 9876543215 · Sector 12</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.text3 }]}>Total Overdue</Text>
              <Text style={[styles.value, { color: colors.red }]}>₹360</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.text3 }]}>Days Late</Text>
              <Text style={[styles.value, { color: colors.text }]}>5</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.label, { color: colors.text3 }]}>Last Payment</Text>
              <Text style={[styles.value, { color: colors.text }]}>May 2, 2025</Text>
            </View>
          </View>

          <View style={[styles.tipCard, { backgroundColor: colors.amberBg }]}>
            <Ionicons name="bulb-outline" size={18} color={colors.amber} />
            <Text style={[styles.tipText, { color: colors.amber }]}>
              Contact the borrower and offer a settlement plan. Avoid aggressive recovery. All calls are recorded.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.ctaPrimary, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={() => {
              Alert.alert('Collection Scheduled', 'Follow-up visit logged. 5% recovery commission on amount collected.');
              router.back();
            }}
          >
            <Text style={styles.ctaText}>Mark as Contacted</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ctaSecondary, { borderColor: colors.red }, pressed && { opacity: 0.85 }]}
            onPress={() => Alert.alert('Recovery Logged', 'Case escalated to legal team for further action.')}
          >
            <Text style={[styles.ctaSecondaryText, { color: colors.red }]}>Escalate to Legal</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl4 },
  avatar: { width: 56, height: 56, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700' },
  profileName: { fontWeight: '700', fontSize: 16 },
  profileSub: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  label: { fontSize: 13 },
  value: { fontWeight: '700' },
  tipCard: { flexDirection: 'row', gap: spacing.smd, borderRadius: radii.sm, padding: spacing.xl + 2, marginTop: spacing.lg, alignItems: 'flex-start' },
  tipText: { fontSize: 12, lineHeight: 18, flex: 1 },
  ctaPrimary: { marginTop: spacing.xl4, paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaSecondary: { marginTop: spacing.smd, paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center', borderWidth: 1.5 },
  ctaSecondaryText: { fontSize: 14, fontWeight: '600' },
});
