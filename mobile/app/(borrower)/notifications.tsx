/**
 * RupeeFast — Borrower Notifications Screen
 *
 * Attempts to fetch from API. Falls back to mock data.
 */

import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

const FALLBACK_NOTIFICATIONS = [
  { id: 1, title: 'EMI Payment Successful', desc: 'Your EMI of ₹120 has been collected successfully.', time: '2 min ago', read: false, icon: 'checkmark-circle' as const, color: '#0B6B4A' },
  { id: 2, title: 'Trust Score Updated', desc: 'Your trust score has increased to 74 (+2 points).', time: '1 hour ago', read: false, icon: 'shield-checkmark' as const, color: '#1B3A6B' },
  { id: 3, title: 'Referral Reward', desc: 'You earned ₹200 from your referral!', time: '2 days ago', read: true, icon: 'gift' as const, color: '#9A6200' },
  { id: 4, title: 'Loan Offer Pre-approved', desc: 'You are pre-approved for ₹12,000. Apply now!', time: '3 days ago', read: true, icon: 'cash' as const, color: '#0B6B4A' },
  { id: 5, title: 'UPI AutoPay Mandate Active', desc: 'Your daily AutoPay of ₹120 is now active.', time: '1 week ago', read: true, icon: 'phone-portrait' as const, color: '#5A3E9B' },
];

export default function BorrowerNotificationsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const fetcher = async () => {
    const result = await apiFetch<any>('/notifications');
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      return result.data;
    }
    return null;
  };

  const { data: notifications, loading } = useTimedAsyncData(fetcher, FALLBACK_NOTIFICATIONS, 3000);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Notifications</Text>
        {unread > 0 && <View style={[styles.unreadBadge, { backgroundColor: colors.red }]}><Text style={styles.unreadText}>{unread}</Text></View>}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ padding: spacing.lg }}>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {notifications.length === 0 && (
                <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
                  <Ionicons name="notifications-off" size={40} color={colors.text3} />
                  <Text style={[styles.notifTitle, { color: colors.text2, marginTop: spacing.lg }]}>No notifications yet</Text>
                </View>
              )}
              {notifications.map((n, i) => (
                <View key={n.id} style={[styles.notifItem, !n.read && { backgroundColor: colors.primaryBg }, i < notifications.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={[styles.notifIcon, { backgroundColor: `${n.color}15` }]}>
                    <Ionicons name={n.icon} size={18} color={n.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.text, fontWeight: n.read ? '500' : '700' }]}>{n.title}</Text>
                    <Text style={[styles.notifDesc, { color: colors.text2 }]}>{n.desc}</Text>
                    <Text style={[styles.notifTime, { color: colors.text3 }]}>{n.time}</Text>
                  </View>
                  {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </View>
              ))}
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
  unreadBadge: { marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  listCard: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  notifItem: { flexDirection: 'row', gap: spacing.lg, padding: spacing.xl + 2, alignItems: 'flex-start' },
  notifIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { fontSize: 13 },
  notifDesc: { fontSize: 12, marginTop: 2 },
  notifTime: { fontSize: 10, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
