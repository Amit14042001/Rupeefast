/**
 * RupeeFast — Investor Notifications Screen
 *
 * Tries to fetch notifications from the backend API with a 3-second timeout.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

interface NotificationItem {
  icon: string;
  color: string;
  label: string;
  desc: string;
  time: string;
}

const FALLBACK_NOTIFICATIONS: NotificationItem[] = [
  { icon: 'cash', color: 'green', label: 'Interest Credited', desc: '₹1,455 interest earned from 92 loans this month', time: 'Today' },
  { icon: 'person-add', color: 'blue', label: 'New Borrowers Added', desc: '8 new borrowers added to your portfolio — ₹4,000 deployed', time: '2d ago' },
  { icon: 'checkmark-circle', color: 'green', label: 'Loan Repaid', desc: 'Borrower Ramesh K. completed their loan of ₹8,000', time: '3d ago' },
  { icon: 'alert-triangle', color: 'amber', label: 'Late Payment Alert', desc: '1 borrower missed EMI — 5 days overdue', time: '4d ago' },
  { icon: 'gift', color: 'purple', label: 'Referral Bonus', desc: '₹500 credited for referring Rajesh Patel', time: '5d ago' },
  { icon: 'document-text', color: 'blue', label: 'Statement Available', desc: 'Your May 2025 statement is ready to download', time: '1w ago' },
  { icon: 'trending-up', color: 'green', label: 'Portfolio Milestone', desc: 'Your portfolio crossed ₹45,000 — great diversification!', time: '1w ago' },
  { icon: 'shield-checkmark', color: 'amber', label: 'KYC Update Required', desc: 'Update your PAN details to remain compliant', time: '2w ago' },
];

const iconBgMap: Record<string, string> = {
  green: '#E3F5EE', amber: '#FEF3DC', blue: '#EBF2FB', purple: '#F0EBFF',
};
const iconColorMap: Record<string, string> = {
  green: '#0B6B4A', amber: '#9A6200', blue: '#1B3A6B', purple: '#5A3E9B',
};

export default function InvestorNotificationsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: notifications, loading } = useTimedAsyncData(
    async (): Promise<NotificationItem[] | null> => {
      const result = await apiFetch('/notifications');
      if (!result.success || !Array.isArray(result.data)) return null;
      const mapped = (result.data as any[]).map((n: any) => ({
        icon: n.icon || 'bell',
        color: n.color || 'blue',
        label: n.title || n.label || 'Notification',
        desc: n.message || n.desc || '',
        time: n.time || n.created_at || '',
      }));
      return mapped.length > 0 ? mapped : null;
    },
    FALLBACK_NOTIFICATIONS,
    3000,
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Notifications</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {notifications.map((n, i) => (
            <View key={i} style={[styles.notifItem, { borderBottomColor: colors.borderLight }]}>
              <View style={[styles.notifIcon, { backgroundColor: iconBgMap[n.color] || colors.surfaceHover }]}>
                <Ionicons name={(n.icon as any) || 'bell'} size={18} color={iconColorMap[n.color] || colors.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifLabel, { color: colors.text }]}>{n.label}</Text>
                <Text style={[styles.notifDesc, { color: colors.text3 }]}>{n.desc}</Text>
              </View>
              <View style={[styles.timeBadge, { backgroundColor: iconBgMap[n.color] || colors.surfaceHover }]}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: iconColorMap[n.color] || colors.text3 }}>{n.time}</Text>
              </View>
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
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1,
  },
  notifIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  notifLabel: { fontWeight: '600', fontSize: 14 },
  notifDesc: { fontSize: 12, marginTop: 2 },
  timeBadge: { paddingHorizontal: spacing.md + 2, paddingVertical: 2, borderRadius: radii.full },
});
