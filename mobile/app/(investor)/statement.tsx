/**
 * RupeeFast — Investor Statement Screen
 *
 * Fetches real transaction history from GET /api/payments/transactions.
 * Falls back to mock data when backend is offline.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchTransactions } from '../../src/services/payments';
import { useAsyncData } from '../../src/hooks/useAsyncData';

const MONTHS = ['May 2025', 'April 2025', 'March 2025'];

const FALLBACK_TXNS: any[] = [
  { id: 1, amount: 1455, type: 'credit', status: 'completed', method: 'autopay', created_at: '2025-05-31T00:00:00Z', notes: 'Interest Payment from 92 active loans' },
  { id: 2, amount: 4000, type: 'debit', status: 'completed', method: 'bank_transfer', created_at: '2025-05-15T00:00:00Z', notes: 'New Investment deployed to 8 borrowers' },
];

export default function StatementScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(0);

  const fetcher = useCallback(async () => {
    const result = await fetchTransactions();
    return result.length > 0 ? result : null;
  }, []);

  const { data: txns, loading } = useAsyncData(fetcher, FALLBACK_TXNS);

  const credits = txns.filter((t: any) => t.type === 'credit' || t.type === 'interest' || t.amount > 0).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const debits = txns.filter((t: any) => t.type === 'debit' || t.type === 'investment').reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Monthly Statement</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Month selector */}
          <View style={styles.monthSelector}>
            <Pressable onPress={() => setSelectedMonth(Math.min(selectedMonth + 1, MONTHS.length - 1))}>
              <Ionicons name="chevron-back" size={18} color={colors.text3} />
            </Pressable>
            <Text style={[styles.monthText, { color: colors.text }]}>{MONTHS[selectedMonth]}</Text>
            <Pressable onPress={() => setSelectedMonth(Math.max(selectedMonth - 1, 0))}>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Pressable>
          </View>

          {/* Summary metrics */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Interest Earned</Text>
              <Text style={[styles.metricValue, { color: colors.green }]}>₹{credits.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>From active loans</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Invested</Text>
              <Text style={[styles.metricValue, { color: colors.primary }]}>₹{debits.toLocaleString('en-IN')}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>Total deployed</Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Withdrawals</Text>
              <Text style={[styles.metricValue, { color: colors.amber }]}>₹0</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>No withdrawals</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.metricLabel, { color: colors.text3 }]}>Transactions</Text>
              <Text style={[styles.metricValue, { color: colors.purple }]}>{txns.length}</Text>
              <Text style={[styles.metricSub, { color: colors.text3 }]}>This period</Text>
            </View>
          </View>

          {/* Transaction History */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Transaction History</Text>
          </View>

          <View style={[styles.txnCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {txns.length === 0 && (
              <View style={{ padding: spacing.xl4, alignItems: 'center' }}>
                <Text style={[styles.txnName, { color: colors.text2 }]}>No transactions yet</Text>
              </View>
            )}
            {txns.map((txn: any, i: number) => {
              const isCredit = txn.type === 'credit' || txn.type === 'interest' || txn.amount > 0;
              return (
                <React.Fragment key={txn.id || i}>
                  {i > 0 && <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />}
                  <View style={styles.txnItem}>
                    <View style={[styles.txnIcon, { backgroundColor: isCredit ? colors.greenBg : colors.primaryBg }]}>
                      <Ionicons name={isCredit ? 'cash' : 'add'} size={16} color={isCredit ? colors.green : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.txnName, { color: colors.text }]}>
                        {txn.notes || (isCredit ? 'Interest Payment' : 'New Investment')}
                      </Text>
                      <Text style={[styles.txnDesc, { color: colors.text3 }]}>
                        {txn.method ? txn.method.replace('_', ' ') : txn.type} · {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txnAmount, { color: isCredit ? colors.green : colors.red }]}>
                        {isCredit ? '+' : '-'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                      </Text>
                      <Text style={[styles.txnDate, { color: colors.text3 }]}>{txn.status}</Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          {/* Download options */}
          <Pressable style={({ pressed }) => [styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.9 }]}>
            <Ionicons name="download-outline" size={22} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Download Statement (PDF)</Text>
              <Text style={[styles.optionSub, { color: colors.text3 }]}>Tax-ready format · {MONTHS[selectedMonth]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text3} />
          </Pressable>

          <Pressable style={({ pressed }) => [styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.9 }]}>
            <Ionicons name="ribbon-outline" size={22} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Tax Certificate (FY 2024-25)</Text>
              <Text style={[styles.optionSub, { color: colors.text3 }]}>Section 80C / Capital Gains summary</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text3} />
          </Pressable>

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
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxl, paddingVertical: spacing.xl + 2 },
  monthText: { fontSize: 15, fontWeight: '600' },
  metricsGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginBottom: spacing.smd },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl },
  metricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  metricSub: { fontSize: 11, marginTop: spacing.ssm },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  txnCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1 },
  txnItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2 },
  txnIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  txnName: { fontWeight: '600', fontSize: 14 },
  txnDesc: { fontSize: 12, marginTop: 2 },
  txnAmount: { fontWeight: '700', fontSize: 13 },
  txnDate: { fontSize: 11, marginTop: 2 },
  divider: { height: 1 },
  optionCard: { marginHorizontal: spacing.lg, marginTop: spacing.smd, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  optionTitle: { fontWeight: '600', fontSize: 14 },
  optionSub: { fontSize: 11, marginTop: 2 },
});
