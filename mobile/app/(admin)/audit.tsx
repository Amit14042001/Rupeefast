/**
 * RupeeFast — Admin Audit Log
 *
 * Layout:
 *   ┌─ Top Nav (title, search) ───────────────────────────┐
 *   ├─ Filter chips (All | Users | Loans | KYC | System) ─┤
 *   ├─ Timeline events (action, user, target, timestamp) ─┤
 *   └─ Event detail (full info on tap) ───────────────────┘
 */

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

type AuditCategory = 'all' | 'user' | 'loan' | 'kyc' | 'system' | 'payment';

interface AuditEvent {
  id: number;
  action: string;
  category: AuditCategory;
  adminName: string;
  target: string;
  detail: string;
  timestamp: string;
  ipAddress: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// ── Fallback data ──

const FALLBACK_EVENTS: AuditEvent[] = [
  { id: 1, action: 'User Blocked', category: 'user', adminName: 'System Admin', target: 'Deepa Iyer (9876543215)', detail: 'Manual block triggered after 3 failed repayment attempts and suspicious activity flag', timestamp: '5 minutes ago', ipAddress: '192.168.1.100', icon: 'person-remove' },
  { id: 2, action: 'Loan Approved', category: 'loan', adminName: 'System Admin', target: 'Ravi Kumar · ₹10,000', detail: 'Loan #3241 approved. Risk score: 82. Daily plan, 100 days.', timestamp: '12 minutes ago', ipAddress: '192.168.1.100', icon: 'checkmark-circle' },
  { id: 3, action: 'KYC Approved', category: 'kyc', adminName: 'System Admin', target: 'Sneha Patel (9876543211)', detail: 'Aadhaar + PAN + Selfie all verified. Low risk.', timestamp: '18 minutes ago', ipAddress: '192.168.1.100', icon: 'shield-checkmark' },
  { id: 4, action: 'Loan Disbursed', category: 'loan', adminName: 'System Admin', target: 'Arjun Reddy · ₹12,000', detail: 'Amount disbursed via UPI. Daily plan, 100 days EMI ₹144.', timestamp: '25 minutes ago', ipAddress: '192.168.1.100', icon: 'cash' },
  { id: 5, action: 'System Config Updated', category: 'system', adminName: 'System Admin', target: 'Processing Fee → 4.5%', detail: 'Processing fee reduced from 5% to 4.5% for all new loans.', timestamp: '1 hour ago', ipAddress: '192.168.1.100', icon: 'settings' },
  { id: 6, action: 'Payment Refunded', category: 'payment', adminName: 'System Admin', target: 'Priya Mehta · ₹2,800', detail: 'Refund processed for canceled investment #892. Transaction ID: TXN_ABC123.', timestamp: '2 hours ago', ipAddress: '192.168.1.100', icon: 'return-down-back' },
  { id: 7, action: 'User Activated', category: 'user', adminName: 'System Admin', target: 'Rahul Verma (9876543218)', detail: 'Account reactivated after KYC resubmission. Previous status: blocked.', timestamp: '2 hours ago', ipAddress: '192.168.1.101', icon: 'person-add' },
  { id: 8, action: 'Fraud Alert Escalated', category: 'system', adminName: 'System Admin', target: 'Device Farming - Amit Sharma', detail: 'Escalated to investigation. Same device detected across 3 accounts.', timestamp: '3 hours ago', ipAddress: '192.168.1.100', icon: 'warning' },
  { id: 9, action: 'Agent Commission Adjusted', category: 'system', adminName: 'System Admin', target: 'Agent: Sunil Verma', detail: 'Commission rate adjusted from 2% to 2.5% due to top performer status.', timestamp: '4 hours ago', ipAddress: '192.168.1.100', icon: 'trending-up' },
  { id: 10, action: 'KYC Rejected', category: 'kyc', adminName: 'System Admin', target: 'Amit Sharma (9876543212)', detail: 'Selfie mismatch with PAN card photo. Resubmission requested.', timestamp: '5 hours ago', ipAddress: '192.168.1.102', icon: 'close-circle' },
];

const CATEGORIES: { key: AuditCategory; label: string }[] = [
  { key: 'all', label: 'All Events' },
  { key: 'user', label: 'Users' },
  { key: 'loan', label: 'Loans' },
  { key: 'kyc', label: 'KYC' },
  { key: 'payment', label: 'Payments' },
  { key: 'system', label: 'System' },
];

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  all: '#2562A8',
  user: '#5A3E9B',
  loan: '#0B6B4A',
  kyc: '#9A6200',
  payment: '#1B3A6B',
  system: '#A02020',
};

export default function AdminAuditScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeCategory, setActiveCategory] = useState<AuditCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null, 1500,
  );

  const filteredEvents = FALLBACK_EVENTS.filter((e) => {
    if (activeCategory !== 'all' && e.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.action.toLowerCase().includes(q) || e.target.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q) || e.adminName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Audit Log</Text>
          <Text style={styles.topNavSub}>{FALLBACK_EVENTS.length} events recorded</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="calendar-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.text3} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search events..."
          placeholderTextColor={colors.text3}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.text3} />
          </Pressable>
        )}
      </View>

      {/* ── Filter Chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.filterChip, { backgroundColor: activeCategory === cat.key ? CATEGORY_COLORS[cat.key] + '20' : colors.surface, borderColor: activeCategory === cat.key ? CATEGORY_COLORS[cat.key] : colors.border }]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={[styles.filterChipText, { color: activeCategory === cat.key ? CATEGORY_COLORS[cat.key] : colors.text2, fontWeight: activeCategory === cat.key ? '700' : '500' }]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : selectedEvent ? (
          /* ── Detail View ── */
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => setSelectedEvent(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Back to log</Text>
            </Pressable>

            <View style={[styles.eventIconLarge, { backgroundColor: CATEGORY_COLORS[selectedEvent.category] + '20' }]}>
              <Ionicons name={selectedEvent.icon} size={32} color={CATEGORY_COLORS[selectedEvent.category]} />
            </View>
            <Text style={[styles.detailAction, { color: colors.text }]}>{selectedEvent.action}</Text>
            <Text style={[styles.detailTimestamp, { color: colors.text3 }]}>{selectedEvent.timestamp}</Text>

            <View style={[styles.detailInfoBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text3 }]}>Admin</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{selectedEvent.adminName}</Text>
              </View>
              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text3 }]}>Target</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{selectedEvent.target}</Text>
              </View>
              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text3 }]}>Category</Text>
                <Text style={[styles.detailValue, { color: CATEGORY_COLORS[selectedEvent.category] }]}>{selectedEvent.category.toUpperCase()}</Text>
              </View>
              <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.text3 }]}>IP Address</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{selectedEvent.ipAddress}</Text>
              </View>
            </View>

            <Text style={[styles.detailHeading, { color: colors.text2 }]}>Details</Text>
            <Text style={[styles.detailDesc, { color: colors.text }]}>{selectedEvent.detail}</Text>
          </View>
        ) : (
          /* ── Timeline ── */
          filteredEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.text3} />
              <Text style={[styles.emptyTitle, { color: colors.text2 }]}>No events found</Text>
              <Text style={[styles.emptySub, { color: colors.text3 }]}>Try adjusting your filters.</Text>
            </View>
          ) : (
            filteredEvents.map((event, idx) => {
              const catColor = CATEGORY_COLORS[event.category];
              return (
                <Pressable
                  key={event.id}
                  style={({ pressed }) => [styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.92 }]}
                  onPress={() => setSelectedEvent(event)}
                >
                  {/* Timeline line connector */}
                  {idx < filteredEvents.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                  <View style={styles.eventRow}>
                    <View style={[styles.eventDot, { backgroundColor: catColor }]} />
                    <View style={[styles.eventIcon, { backgroundColor: catColor + '15' }]}>
                      <Ionicons name={event.icon} size={18} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.eventHeader}>
                        <Text style={[styles.eventAction, { color: colors.text }]}>{event.action}</Text>
                        <Text style={[styles.eventTime, { color: colors.text3 }]}>{event.timestamp}</Text>
                      </View>
                      <Text style={[styles.eventTarget, { color: colors.text3 }]}>{event.target}</Text>
                      <Text style={[styles.eventDetail, { color: colors.text3 }]} numberOfLines={1}>{event.detail}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                  </View>
                </Pressable>
              );
            })
          )
        )}
        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.smd },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.smd, borderRadius: radii.xs, borderWidth: 1, paddingHorizontal: spacing.xl + 2, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500' },
  filterScroll: { marginTop: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  eventCard: { marginHorizontal: spacing.xl + 2, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.sm, marginLeft: spacing.xl5 + spacing.lg, position: 'relative' },
  timelineLine: { position: 'absolute', left: -(spacing.xl5 + spacing.md + 2), top: 0, bottom: 0, width: 2 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  eventDot: { position: 'absolute', left: -(spacing.xl5 + spacing.md + 2), width: 10, height: 10, borderRadius: 5, zIndex: 1 },
  eventIcon: { width: 36, height: 36, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventAction: { fontWeight: '700', fontSize: 13 },
  eventTime: { fontSize: 10, fontWeight: '500' },
  eventTarget: { fontSize: 11, marginTop: 2 },
  eventDetail: { fontSize: 10, marginTop: 1, color: '#9CA3AF' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl5 * 2 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: spacing.xl },
  emptySub: { fontSize: 13, marginTop: spacing.sm },
  detailCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.smd },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl4 },
  backText: { fontSize: 13, fontWeight: '600' },
  eventIconLarge: { width: 64, height: 64, borderRadius: radii.xl, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  detailAction: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: spacing.xl },
  detailTimestamp: { fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  detailInfoBox: { borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl, marginTop: spacing.xl4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  detailDivider: { height: 1 },
  detailLabel: { fontSize: 12, fontWeight: '500' },
  detailValue: { fontSize: 13, fontWeight: '600' },
  detailHeading: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl4, marginBottom: spacing.md },
  detailDesc: { fontSize: 13, lineHeight: 20 },
});
