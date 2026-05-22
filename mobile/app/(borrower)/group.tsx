/**
 * RupeeFast — Borrower Group Loans Screen
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

const GROUPS = [
  { id: 1, name: 'Family Fund', members: 4, total: 48000, yourShare: 12000, icon: 'people' },
  { id: 2, name: 'Business Circle', members: 6, total: 72000, yourShare: 12000, icon: 'business' },
];

export default function BorrowerGroupScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Group Loans</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          <View style={[styles.infoCard, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="people" size={32} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Borrow Together, Grow Together</Text>
            <Text style={[styles.infoDesc, { color: colors.text2 }]}>
              Form a group with trusted friends/family to access higher loan amounts at lower interest rates.
            </Text>
          </View>

          {GROUPS.map((group) => (
            <Pressable key={group.id} style={({ pressed }) => [styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name={group.icon as any} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.lg }}>
                  <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                  <Text style={[styles.groupMembers, { color: colors.text3 }]}>{group.members} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text3} />
              </View>
              <View style={styles.groupStats}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.groupStatVal, { color: colors.primary }]}>₹{group.total.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.groupStatLabel, { color: colors.text3 }]}>Total Limit</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border, height: 30 }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={[styles.groupStatVal, { color: colors.green }]}>₹{group.yourShare.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.groupStatLabel, { color: colors.text3 }]}>Your Share</Text>
                </View>
              </View>
            </Pressable>
          ))}

          <Pressable style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Create New Group</Text>
          </Pressable>
        </View>
        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 },
  infoCard: { borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center', marginBottom: spacing.xl4 },
  infoTitle: { fontSize: 16, fontWeight: '700', marginTop: spacing.smd },
  infoDesc: { fontSize: 12, textAlign: 'center', marginTop: spacing.smd, lineHeight: 18 },
  groupCard: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  groupHeader: { flexDirection: 'row', alignItems: 'center' },
  groupIcon: { width: 44, height: 44, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 15, fontWeight: '600' },
  groupMembers: { fontSize: 11, marginTop: 1 },
  groupStats: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.xl4 },
  groupStatVal: { fontSize: 18, fontWeight: '800' },
  groupStatLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  createBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.smd, marginTop: spacing.lg, paddingVertical: spacing.xl, borderRadius: radii.sm },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
