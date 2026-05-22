/**
 * RupeeFast — Borrower Profile Screen
 *
 * Shows real user data from the auth store.
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { useAuthStore } from '../../src/stores/auth-store';

export default function BorrowerProfileScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);
  const displayMobile = user?.mobile
    ? user.mobile.replace(/(\d{5})(\d{5})/, '$1 $2')
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>My Profile</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.phone, { color: colors.text3 }]}>+91 {displayMobile}</Text>
          <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{(user?.role || 'borrower').charAt(0).toUpperCase() + (user?.role || 'borrower').slice(1)}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: spacing.lg }]}>
          {[
            { label: 'Full Name', value: user?.name || '—', icon: 'person' },
            { label: 'Mobile', value: user?.mobile || '—', icon: 'call' },
            { label: 'Role', value: (user?.role || '—').charAt(0).toUpperCase() + (user?.role || '').slice(1), icon: 'shield' },
            { label: 'User ID', value: user?.id ? `#${user.id}` : '—', icon: 'hash' },
          ].map((field, i) => (
            <View key={i} style={[styles.fieldRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
              <Ionicons name={field.icon as any} size={16} color={colors.text3} />
              <View style={{ flex: 1, marginLeft: spacing.smd }}>
                <Text style={[styles.fieldLabel, { color: colors.text3 }]}>{field.label}</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>{field.value}</Text>
              </View>
            </View>
          ))}
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
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', marginTop: spacing.lg },
  phone: { fontSize: 14, marginTop: spacing.xs },
  badge: { paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.ssm, borderRadius: radii.full, marginTop: spacing.smd },
  badgeText: { fontSize: 11, fontWeight: '600' },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  fieldLabel: { fontSize: 11 },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
});
