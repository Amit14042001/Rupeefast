/**
 * RupeeFast — Borrower Payment History Screen
 *
 * Fetches transaction history from backend/api/payments/transactions.
 * Falls back to demo data when offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { ENDPOINTS } from '../../src/api/endpoints';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import type { TransactionsResponse } from '../../src/types';

const DEMO_TRANSACTIONS = [
  { id: 1, amount: 120, type: 'repayment', status: 'completed', method: 'upi_autopay', created_at: new Date().toISOString() },
  { id: 2, amount: 120, type: 'repayment', status: 'completed', method: 'upi_autopay', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, amount: 120, type: 'repayment', status: 'completed', method: 'upi_autopay', created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 4, amount: 120, type: 'repayment', status: 'completed', method: 'upi_autopay', created_at: new Date(Date.now() - 259200000).toISOString() },
  { id: 5, amount: 120, type: 'repayment', status: 'completed', method: 'upi_autopay', created_at: new Date(Date.now() - 345600000).toISOString() },
  { id: 6, amount: 8000, type: 'disbursal', status: 'completed', method: 'neft', created_at: new Date(Date.now() - 604800000).toISOString() },
];

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function BorrowerHistoryScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const { data: transactions, loading: isLoading } = useAsyncData(
    async () => {
      const result = await apiFetch<TransactionsResponse>(ENDPOINTS.TRANSACTIONS);
      if (result.success && result.data.transactions.length > 0) {
        return result.data.transactions;
      }
      return null;
    },
    DEMO_TRANSACTIONS,
  );

  const repaidAmount = transactions
    .filter(t => t.type === 'repayment' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const emisPaid = transactions.filter(t => t.type === 'repayment' && t.status === 'completed').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Payment History</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.statValue, { color: colors.green }]}>₹{repaidAmount}</Text>
                <Text style={[styles.statTitle, { color: colors.text3 }]}>Repaid</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border, height: 40 }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{emisPaid}</Text>
                <Text style={[styles.statTitle, { color: colors.text3 }]}>Payments</Text>
              </View>
            </View>
          </View>

          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isLoading ? (
              <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
                <Text style={[styles.loadingText, { color: colors.text3 }]}>Loading...</Text>
              </View>
            ) : (
              transactions.map((tx, i) => {
                const isCredit = tx.type === 'disbursal';
                const iconName = isCredit ? 'arrow-down' : 'arrow-up';
                const iconBg = isCredit ? colors.greenBg : colors.primaryBg;
                const iconColor = isCredit ? colors.green : colors.primary;
                const typeLabel = tx.type === 'repayment' ? 'EMI Payment' : tx.type === 'disbursal' ? 'Loan Disbursal' : tx.type;

                return (
                  <View key={tx.id} style={[styles.txItem, i < transactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
                      <Ionicons name={iconName as any} size={16} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txType, { color: colors.text }]}>{typeLabel}</Text>
                      <Text style={[styles.txMethod, { color: colors.text3 }]}>{tx.method?.replace('_', ' ').toUpperCase()}</Text>
                      <Text style={[styles.txDate, { color: colors.text3 }]}>{formatDate(tx.created_at)}</Text>
                    </View>
                    <Text style={[styles.txAmount, { color: isCredit ? colors.green : colors.text, fontWeight: '700' }]}>
                      {isCredit ? '+' : '-'}₹{tx.amount}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
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
  statsCard: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl4, marginBottom: spacing.lg },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statTitle: { fontSize: 10, fontWeight: '600', marginTop: spacing.xs, textTransform: 'uppercase' },
  listCard: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  loadingText: { fontSize: 13 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2 },
  txIcon: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  txType: { fontSize: 13, fontWeight: '600' },
  txMethod: { fontSize: 10, marginTop: 1 },
  txDate: { fontSize: 10, marginTop: 1 },
  txAmount: { fontSize: 15 },
});
