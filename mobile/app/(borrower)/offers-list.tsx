/**
 * RupeeFast — Borrower Pre-Approved Offers List
 *
 * Shows all pre-approved `loan_offers` from the credit engine.
 * Each offer card displays amount, rate, tenure, expiry — with accept/reject actions.
 * Falls back to mock data when backend is offline.
 */

import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radii } from '../../src/theme';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { fetchOffers, acceptOffer, rejectOffer } from '../../src/services/offers';
import type { LoanOffer, OfferStatus } from '../../src/types';

// ── Fallback mock offers ──

const FALLBACK_OFFERS: LoanOffer[] = [
  {
    id: 1, user_id: 1, amount: 8000, interest_rate: 20, tenure_days: 100,
    processing_fee: 400, status: 'pending', expires_at: '2025-07-15T00:00:00Z',
    source: 'credit_engine', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z',
  },
  {
    id: 2, user_id: 1, amount: 12000, interest_rate: 18, tenure_days: 150,
    processing_fee: 600, status: 'pending', expires_at: '2025-07-20T00:00:00Z',
    source: 'campaign', metadata: { campaign: 'summer25' }, created_at: '2025-06-05T00:00:00Z', updated_at: '2025-06-05T00:00:00Z',
  },
  {
    id: 3, user_id: 1, amount: 5000, interest_rate: 22, tenure_days: 75,
    processing_fee: 250, status: 'expired', expires_at: '2025-05-01T00:00:00Z',
    source: 'referral', created_at: '2025-04-01T00:00:00Z', updated_at: '2025-04-01T00:00:00Z',
  },
  {
    id: 4, user_id: 1, amount: 20000, interest_rate: 16, tenure_days: 200,
    processing_fee: 1000, status: 'pending', expires_at: '2025-08-01T00:00:00Z',
    source: 'credit_engine', metadata: { risk_tier: 'platinum' }, created_at: '2025-06-10T00:00:00Z', updated_at: '2025-06-10T00:00:00Z',
  },
];

// ── Helpers ──

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  credit_engine: { label: 'AI Recommended', color: '#1B3A6B', bg: '#EBF2FB' },
  admin:         { label: 'Manual Offer',   color: '#9A6200', bg: '#FEF3DC' },
  campaign:      { label: 'Campaign',       color: '#5A3E9B', bg: '#F0EBFF' },
  referral:      { label: 'Referral Bonus', color: '#0B6B4A', bg: '#E3F5EE' },
};

const STATUS_CONFIG: Record<OfferStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Active',   color: '#0B6B4A', bg: '#E3F5EE' },
  accepted:  { label: 'Accepted', color: '#1B3A6B', bg: '#EBF2FB' },
  rejected:  { label: 'Rejected', color: '#9A6200', bg: '#FEF3DC' },
  expired:   { label: 'Expired',  color: '#A02020', bg: '#FDEAEA' },
  converted: { label: 'Converted',color: '#0B6B4A', bg: '#E3F5EE' },
};

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Components ──

function OfferCard({
  offer,
  onAccept,
  onReject,
  colors,
}: {
  offer: LoanOffer;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  colors: any;
}) {
  const expired = isExpired(offer.expires_at);
  const sc = SOURCE_CONFIG[offer.source] || SOURCE_CONFIG.credit_engine;
  const stc = STATUS_CONFIG[offer.status] || STATUS_CONFIG.pending;
  const repayAmount = Math.round(offer.amount * (1 + offer.interest_rate / 100));
  const dailyEmi = Math.round(repayAmount / offer.tenure_days);
  const disbursal = offer.amount - offer.processing_fee;
  const remaining = daysRemaining(offer.expires_at);

  return (
    <View style={[styles.offerCard, { backgroundColor: colors.surface, borderColor: expired && offer.status === 'pending' ? '#FDEAEA' : colors.border }]}>
      {/* Header */}
      <View style={styles.offerHeader}>
        <View style={[styles.sourceBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.sourceText, { color: sc.color }]}>{sc.label}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: stc.bg }]}>
          <Text style={[styles.statusText, { color: stc.color }]}>{stc.label}</Text>
        </View>
      </View>

      {/* Amount */}
      <View style={styles.amountRow}>
        <Text style={[styles.amountLabel, { color: colors.text3 }]}>Loan Amount</Text>
        <Text style={[styles.amountValue, { color: colors.text }]}>₹{offer.amount.toLocaleString('en-IN')}</Text>
      </View>

      {/* Details Grid */}
      <View style={[styles.detailsGrid, { borderColor: colors.borderLight }]}>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.text3 }]}>Interest</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{offer.interest_rate}% p.a.</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.text3 }]}>Tenure</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>{offer.tenure_days} days</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.text3 }]}>Daily EMI</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>₹{dailyEmi}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={[styles.detailLabel, { color: colors.text3 }]}>Disbursal</Text>
          <Text style={[styles.detailValue, { color: colors.green }]}>₹{disbursal.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Expiry / Accept-Reject */}
      {offer.status === 'pending' && !expired && (
        <>
          {remaining <= 3 && (
            <View style={[styles.expiryWarning, { backgroundColor: '#FEF3DC' }]}>
              <Ionicons name="time-outline" size={14} color="#9A6200" />
              <Text style={styles.expiryWarningText}>
                Expires in {remaining} day{remaining !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.acceptBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
              onPress={() => onAccept(offer.id)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.rejectBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              onPress={() => onReject(offer.id)}
            >
              <Ionicons name="close-circle" size={16} color={colors.text3} />
              <Text style={[styles.rejectBtnText, { color: colors.text3 }]}>Skip</Text>
            </Pressable>
          </View>
        </>
      )}

      {expired && offer.status === 'pending' && (
        <View style={[styles.expiredBadge, { backgroundColor: '#FDEAEA' }]}>
          <Ionicons name="alert-circle" size={14} color="#A02020" />
          <Text style={styles.expiredText}>Offer expired on {formatDate(offer.expires_at)}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ──

export default function BorrowerOffersListScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data: offers, loading, refresh: mutate } = useAsyncData(
    async () => {
      const result = await fetchOffers();
      return result.length > 0 ? result : null;
    },
    FALLBACK_OFFERS,
  );

  const activeOffers = offers.filter((o) => o.status === 'pending' && !isExpired(o.expires_at));
  const otherOffers = offers.filter((o) => o.status !== 'pending' || isExpired(o.expires_at));

  const handleAccept = (id: number) => {
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    Alert.alert(
      'Accept Offer',
      `Accept ₹${offer.amount.toLocaleString('en-IN')} loan offer?\n\nYou'll receive ₹${(offer.amount - offer.processing_fee).toLocaleString('en-IN')} after processing fee.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Proceed',
          onPress: async () => {
            const result = await acceptOffer(id);
            if (result.success) {
              Alert.alert(
                'Offer Accepted!',
                result.loanId
                  ? `Your loan has been created (ID: ${result.loanId}). Redirecting to loan details...`
                  : 'Your offer has been accepted. Redirecting...',
                [{ text: 'OK', onPress: () => router.push('/(borrower)/(tabs)/home') }],
              );
              mutate();
            } else {
              Alert.alert('Error', result.error || 'Failed to accept offer. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleReject = (id: number) => {
    Alert.alert(
      'Skip Offer',
      'Are you sure you want to skip this offer? You can re-apply anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            await rejectOffer(id);
            mutate();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Pre-Approved Offers</Text>
        {activeOffers.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.countBadgeText}>{activeOffers.length}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ padding: spacing.xl5 * 2, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* ── Hero Banner ── */}
            {activeOffers.length > 0 && (
              <LinearGradient
                colors={['#1B3A6B', '#2562A8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBanner}
              >
                <Ionicons name="gift" size={28} color="#fff" style={{ opacity: 0.9 }} />
                <Text style={styles.heroTitle}>
                  {activeOffers.length} Pre-Approved Offer{activeOffers.length !== 1 ? 's' : ''} Available
                </Text>
                <Text style={styles.heroSub}>
                  Based on your Trust Score, you're eligible for exclusive loan offers. Offers expire soon — don't miss out!
                </Text>
              </LinearGradient>
            )}

            {offers.length === 0 && (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="file-tray-outline" size={40} color={colors.text3} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Offers Available</Text>
                <Text style={[styles.emptyDesc, { color: colors.text3 }]}>
                  New pre-approved offers will appear here once your credit profile is evaluated.
                </Text>
              </View>
            )}

            {/* ── Active Offers ── */}
            {activeOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onAccept={handleAccept}
                onReject={handleReject}
                colors={colors}
              />
            ))}

            {/* ── History Section ── */}
            {otherOffers.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text3 }]}>History</Text>
                </View>
                {otherOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    colors={colors}
                  />
                ))}
              </>
            )}

            <View style={{ height: spacing.xl5 }} />
          </>
        )}
      </ScrollView>
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
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd, flex: 1 },
  countBadge: { width: 24, height: 24, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },

  heroBanner: { margin: spacing.lg, borderRadius: radii.sm, padding: spacing.xl + 2, gap: spacing.smd },
  heroTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl5 * 2, paddingHorizontal: spacing.xl4 },
  emptyIcon: { width: 80, height: 80, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: spacing.xl4 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: spacing.smd, lineHeight: 20 },

  offerCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  offerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sourceBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  sourceText: { fontSize: 10, fontWeight: '600' },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  statusText: { fontSize: 10, fontWeight: '600' },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, paddingBottom: spacing.lg },
  amountLabel: { fontSize: 12, fontWeight: '500' },
  amountValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingTop: spacing.xl },
  detailItem: { width: '50%', marginBottom: spacing.smd },
  detailLabel: { fontSize: 11, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  expiryWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.sm, marginTop: spacing.smd },
  expiryWarningText: { fontSize: 11, fontWeight: '600', color: '#9A6200' },

  actionRow: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.xl },
  acceptBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderRadius: radii.sm },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderRadius: radii.sm, borderWidth: 1 },
  rejectBtnText: { fontSize: 14, fontWeight: '600' },

  expiredBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.sm, marginTop: spacing.smd },
  expiredText: { fontSize: 11, fontWeight: '600', color: '#A02020' },

  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
});
