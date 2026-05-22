/**
 * RupeeFast — Borrower Account Hub Tab
 *
 * Central hub for profile, settings, notifications, referrals,
 * loyalty, and all account-related actions.
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../../src/theme';

interface MenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  desc?: string;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Account',
    items: [
      { label: 'My Profile', icon: 'person-outline', route: '/profile', color: '#1B3A6B', desc: 'Personal info & documents' },
      { label: 'Notifications', icon: 'notifications-outline', route: '/notifications', color: '#9A6200', desc: 'Alerts & updates' },
      { label: 'Trust Score', icon: 'shield-checkmark-outline', route: '/score', color: '#0B6B4A', desc: 'Your credit health' },
      { label: 'Payment History', icon: 'receipt-outline', route: '/history', color: '#5A3E9B', desc: 'All transactions' },
    ],
  },
  {
    title: 'Benefits',
    items: [
      { label: 'Refer & Earn', icon: 'share-outline', route: '/refer', color: '#1B3A6B', desc: 'Invite friends, earn ₹200' },
      { label: 'Loyalty Rewards', icon: 'diamond-outline', route: '/loyalty', color: '#9A6200', desc: 'Cashback & perks' },
      { label: 'Group Loans', icon: 'people-outline', route: '/group', color: '#0B6B4A', desc: 'Borrow with friends' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Help & FAQs', icon: 'help-circle-outline', route: '/help', color: '#5A3E9B', desc: 'Get support' },
      { label: 'Payment Mandates', icon: 'card-outline', route: '/mandates', color: '#1B3A6B', desc: 'Manage AutoPay & NACH' },
      { label: 'Settings', icon: 'settings-outline', route: '/settings', color: '#9A6200', desc: 'Preferences & security' },
    ],
  },
];

function MenuItemCard({ item, colors }: { item: MenuItem; colors: any }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.surface },
        pressed && { opacity: 0.7, paddingLeft: 20 },
      ]}
      onPress={() => router.push(`/(borrower)${item.route}` as any)}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.menuBody}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
        {item.desc && <Text style={[styles.menuDesc, { color: colors.text3 }]}>{item.desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
    </Pressable>
  );
}

export default function BorrowAccountScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { paddingTop: top + spacing.xl3, backgroundColor: colors.primary }]}>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>RK</Text>
        </View>
        <Text style={styles.profileName}>Ramesh Kumar</Text>
        <Text style={styles.profilePhone}>+91 98765 43210</Text>
        <View style={styles.profileBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#fff" />
          <Text style={styles.profileBadgeText}>Trust Score: 74</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {MENU_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>{section.title}</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.items.map((item, ii) => (
                <MenuItemCard key={ii} item={item} colors={colors} />
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.replace('/')}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.red} />
          <Text style={[styles.logoutText, { color: colors.red }]}>Log Out</Text>
        </Pressable>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: { alignItems: 'center', paddingBottom: spacing.xl4, paddingHorizontal: spacing.xxl },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.smd },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  profilePhone: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.smd, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.ssm, borderRadius: radii.full },
  profileBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  menuCard: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2, gap: spacing.lg },
  menuIcon: { width: 40, height: 40, borderRadius: radii.sm + 2, justifyContent: 'center', alignItems: 'center' },
  menuBody: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  menuDesc: { fontSize: 11, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.xl4, paddingVertical: spacing.xl + 2, borderRadius: radii.sm },
  logoutText: { fontSize: 14, fontWeight: '600' },
});
