/**
 * RupeeFast — Borrower Payment Mandates Screen
 *
 * Fetches mandates from /api/payments/mandates.
 * Supports pause, cancel, resume actions via API.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { ENDPOINTS } from '../../src/api/endpoints';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { MandatesResponse } from '../../src/types';

const DEMO_MANDATES: MandatesResponse['mandates'] = [
  {
    id: 1, user_id: 1, loan_id: 1,
    razorpay_subscription_id: 'sub_demo_001', razorpay_plan_id: 'plan_demo_001',
    method: 'upi_autopay', status: 'active', amount: 120, frequency: 'daily',
    remaining_cycles: 67, total_cycles: 100,
    created_at: new Date().toISOString(),
  },
  {
    id: 2, user_id: 1, loan_id: 2,
    razorpay_subscription_id: 'sub_demo_002', razorpay_plan_id: 'plan_demo_002',
    method: 'nach', status: 'paused', amount: 3600, frequency: 'monthly',
    remaining_cycles: 3, total_cycles: 6,
    created_at: new Date().toISOString(),
  },
];

export default function BorrowerMandatesScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [mandates, setMandates] = useState<MandatesResponse['mandates']>([]);

  const { data: initialMandates, loading: isLoading } = useAsyncData(
    async () => {
      const result = await apiFetch<MandatesResponse>(ENDPOINTS.MANDATES);
      if (result.success && result.data.mandates.length > 0) {
        setMandates(result.data.mandates);
        return result.data.mandates;
      }
      setMandates(DEMO_MANDATES);
      return null;
    },
    DEMO_MANDATES,
  );

  // Ensure mandates is populated from initialMandates (fallback is set directly in fetcher)
  if (mandates.length === 0 && initialMandates.length > 0 && !isLoading) {
    setMandates(initialMandates);
  }

  const handlePause = async (mandateId: number) => {
    const result = await apiFetch(ENDPOINTS.PAUSE_MANDATE, {
      method: 'POST',
      body: { mandate_id: mandateId },
    });

    if (result.success) {
      setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, status: 'paused' } : m));
      Alert.alert('Paused', 'Mandate has been paused');
    } else {
      Alert.alert('Error', result.error || 'Failed to pause mandate');
    }
  };

  const handleResume = async (mandateId: number) => {
    const result = await apiFetch(ENDPOINTS.RESUME_MANDATE, {
      method: 'POST',
      body: { mandate_id: mandateId },
    });

    if (result.success) {
      setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, status: 'active' } : m));
      Alert.alert('Resumed', 'Mandate has been resumed');
    } else {
      Alert.alert('Error', result.error || 'Failed to resume mandate');
    }
  };

  const handleCancel = async (mandateId: number) => {
    Alert.alert(
      'Cancel Mandate',
      'Are you sure you want to cancel this mandate?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const result = await apiFetch(ENDPOINTS.CANCEL_MANDATE, {
              method: 'POST',
              body: { mandate_id: mandateId },
            });

            if (result.success) {
              setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, status: 'cancelled' } : m));
              Alert.alert('Cancelled', 'Mandate has been cancelled');
            } else {
              Alert.alert('Error', result.error || 'Failed to cancel mandate');
            }
          },
        },
      ],
    );
  };

  const activeMandates = mandates.filter(m => m.status === 'active' || m.status === 'paused');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Payment Mandates</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Active Mandates</Text>

          {isLoading ? (
            <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
              <Text style={[styles.loadingText, { color: colors.text3 }]}>Loading...</Text>
            </View>
          ) : activeMandates.length === 0 ? (
            <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
              <Ionicons name="shield-outline" size={40} color={colors.text3} />
              <Text style={[styles.emptyText, { color: colors.text3, marginTop: spacing.smd }]}>No active mandates</Text>
            </View>
          ) : (
            activeMandates.map((m) => {
              const isActive = m.status === 'active';
              const statusColor = isActive ? colors.green : colors.amber;
              const statusBg = isActive ? colors.greenBg : colors.amberBg;
              const iconName = m.method === 'nach' ? 'business' : 'phone-portrait';
              const iconColor = m.method === 'nach' ? '#9A6200' : '#0B6B4A';

              return (
                <View key={m.id} style={[styles.mandateCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: statusColor }]}>
                  <View style={styles.mandateHeader}>
                    <View style={[styles.mandateIcon, { backgroundColor: `${iconColor}15` }]}>
                      <Ionicons name={iconName as any} size={22} color={iconColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.lg }}>
                      <Text style={[styles.mandateType, { color: colors.text }]}>
                        {m.method === 'nach' ? 'NACH Mandate' : 'UPI AutoPay'}
                      </Text>
                      <Text style={[styles.mandateProvider, { color: colors.text3 }]}>
                        {m.frequency.charAt(0).toUpperCase() + m.frequency.slice(1)} collection
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.mandateDetails, { borderTopColor: colors.borderLight, borderBottomColor: colors.borderLight }]}>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: colors.text3 }]}>Amount</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>₹{m.amount}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: colors.text3 }]}>Frequency</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {m.frequency.charAt(0).toUpperCase() + m.frequency.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={[styles.detailLabel, { color: colors.text3 }]}>Remaining</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{m.remaining_cycles} cycles</Text>
                    </View>
                  </View>

                  <View style={styles.mandateActions}>
                    {isActive ? (
                      <Pressable
                        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handlePause(m.id)}
                      >
                        <Text style={[styles.actionText, { color: colors.amber }]}>Pause</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleResume(m.id)}
                      >
                        <Text style={[styles.actionText, { color: colors.green }]}>Resume</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => handleCancel(m.id)}
                    >
                      <Text style={[styles.actionText, { color: colors.red }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Pressable
            style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(borrower)/pay')}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Set Up New Mandate</Text>
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
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  loadingText: { fontSize: 13 },
  emptyText: { fontSize: 13 },
  mandateCard: { borderRadius: radii.sm, borderWidth: 1, borderLeftWidth: 3, marginBottom: spacing.lg, overflow: 'hidden' },
  mandateHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  mandateIcon: { width: 44, height: 44, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  mandateType: { fontSize: 15, fontWeight: '600' },
  mandateProvider: { fontSize: 11, marginTop: 1 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  statusText: { fontSize: 10, fontWeight: '600' },
  mandateDetails: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  detailItem: { flex: 1, alignItems: 'center', padding: spacing.lg },
  detailLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  detailValue: { fontSize: 13, fontWeight: '700', marginTop: spacing.xs },
  mandateActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, padding: spacing.smd + 2 },
  actionBtn: { paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.smd },
  actionText: { fontSize: 12, fontWeight: '600' },
  addBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.smd, marginTop: spacing.lg, paddingVertical: spacing.xl, borderRadius: radii.sm },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
