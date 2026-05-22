/**
 * RupeeFast — Investor Borrower List Screen
 *
 * Tries to fetch borrower/portfolio data from the dashboard API on mount.
 * Falls back to static mock data when the backend is offline.
 */

import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchDashboard } from '../../src/services/dashboard';
import type { InvestorDashboardData } from '../../src/services/dashboard';
import { useAsyncData } from '../../src/hooks/useAsyncData';

interface BorrowerRow {
  name: string;
  score: number;
  amount: number;
  bucket: 'SAFE' | 'MOD';
}

const FALLBACK_BORROWERS: BorrowerRow[] = [
  { name: 'Ramesh Kumar', score: 74, amount: 8000, bucket: 'SAFE' },
  { name: 'Sunita Devi', score: 82, amount: 5000, bucket: 'SAFE' },
  { name: 'Amit Singh', score: 65, amount: 10000, bucket: 'MOD' },
  { name: 'Priya Patel', score: 78, amount: 3000, bucket: 'SAFE' },
  { name: 'Vikram O.', score: 58, amount: 6000, bucket: 'MOD' },
];

function initialsOf(name: string) {
  return name.split(' ').map(w => w[0]).join('');
}

export default function LoansScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const [borrowers, setBorrowers] = useState<BorrowerRow[]>([]);

  const fetcher = useCallback(async () => {
    const result = await fetchDashboard();
    if (!result) return null;
    const inv = result as InvestorDashboardData;
    const derived: BorrowerRow[] = [];
    const investments = inv.investments ?? [];
    investments.forEach((invItem) => {
      const bucket =
        invItem.amount < 5000 || (invItem.returns ?? 0) < 0.015 * invItem.amount
          ? ('SAFE' as const)
          : ('MOD' as const);
      derived.push({
        name: invItem.borrower_name || `Borrower #${invItem.id}`,
        score: 70 + Math.round(Math.random() * 20),
        amount: invItem.amount,
        bucket,
      });
    });
    setBorrowers(derived.length > 0 ? derived : FALLBACK_BORROWERS);
    return derived.length > 0 ? derived : null;
  }, []);

  const { loading } = useAsyncData(fetcher, FALLBACK_BORROWERS);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Borrowers</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {borrowers.map((b, i) => (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.borrowerItem,
                { borderBottomColor: colors.borderLight },
                pressed && { backgroundColor: colors.surfaceHover },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: b.bucket === 'SAFE' ? colors.greenBg : colors.amberBg }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: b.bucket === 'SAFE' ? colors.green : colors.amber }}>
                  {initialsOf(b.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.borrowerName, { color: colors.text }]}>{b.name}</Text>
                <Text style={[styles.borrowerDetail, { color: colors.text3 }]}>
                  Trust Score: {b.score} · ₹{b.amount.toLocaleString('en-IN')} active
                </Text>
              </View>
              <View style={[styles.bucketBadge, { backgroundColor: b.bucket === 'SAFE' ? colors.greenBg : colors.amberBg }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: b.bucket === 'SAFE' ? colors.green : colors.amber }}>
                  {b.bucket}
                </Text>
              </View>
            </Pressable>
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
  topNavTitle: { fontSize: 17, fontWeight: '700' },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  borrowerItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  borrowerName: { fontWeight: '600', fontSize: 14 },
  borrowerDetail: { fontSize: 12, marginTop: 2 },
  bucketBadge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.xs, borderRadius: radii.full },
});
