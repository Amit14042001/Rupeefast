/**
 * RupeeFast — Investor Profile Screen
 */

import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { useAuthStore } from '../../src/stores/auth-store';

export default function InvestorProfileScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>My Profile</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl5 }}>
          <View style={[styles.avatar, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.avatarText, { color: colors.green }]}>AS</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'Anita Sharma'}</Text>
          <Text style={[styles.phone, { color: colors.text3 }]}>+91 {user?.mobile || '9988776655'}</Text>
        </View>

        <MenuItem icon="business-outline" label="Linked Bank Account" badge="SBI" badgeColor={colors.primary} colors={colors} />
        <MenuItem icon="document-text-outline" label="Tax Statements" onPress={() => router.push('/(investor)/statement' as any)} colors={colors} />
        <MenuItem icon="gift-outline" label="Refer a Friend" onPress={() => router.push('/(investor)/referral' as any)} colors={colors} />
        <MenuItem icon="help-circle-outline" label="Help & Support" colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <MenuItem
          icon="log-out-outline" label="Logout"
          labelColor={colors.red}
          colors={colors}
          onPress={() => {
            logout();
            router.replace('/');
          }}
        />

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon, label, badge, badgeColor, labelColor, onPress, colors,
}: {
  icon: keyof typeof Ionicons.glyphMap; label: string; badge?: string; badgeColor?: string; labelColor?: string; onPress?: () => void; colors: any;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceHover }]}
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: colors.greenBg }]}>
        <Ionicons name={icon} size={18} color={colors.green} />
      </View>
      <Text style={[styles.menuLabel, { color: labelColor || colors.text }]}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: badgeColor }}>{badge}</Text>
        </View>
      ) : (
        onPress && <Ionicons name="chevron-forward" size={16} color={colors.text3} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  topNavTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', marginTop: spacing.lg },
  phone: { fontSize: 13, marginTop: spacing.ssm },
  divider: { height: 1, marginVertical: spacing.md, marginHorizontal: spacing.xxl },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl },
  menuIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontWeight: '600', fontSize: 14 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
});
