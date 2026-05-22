/**
 * RupeeFast — Admin KYC Review
 *
 * Layout:
 *   ┌─ Top Nav (title, filter tabs) ──────────────────────┐
 *   ├─ Queue summary (Pending | Approved | Rejected) ─────┤
 *   ├─ KYC Item Cards (user, docs, status, actions) ───────┤
 *   └─ Bottom tab nav ──────────────────────────────────────┘
 */

import { useCallback, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

type KYCStatus = 'pending' | 'approved' | 'rejected';
type FilterTab = 'all' | KYCStatus;

interface KYCItem {
  id: number;
  name: string;
  mobile: string;
  pan: string;
  aadhaar: string;
  selfie: boolean;
  submittedAt: string;
  status: KYCStatus;
  risk: 'low' | 'medium' | 'high';
  notes?: string;
}

// ── Fallback KYC queue ──

const FALLBACK_KYC_QUEUE: KYCItem[] = [
  { id: 1, name: 'Ravi Kumar',  mobile: '9876543210', pan: 'ABCDE1234F', aadhaar: 'XXXX-XXXX-1234', selfie: true,  submittedAt: '2 hours ago', status: 'pending', risk: 'low' },
  { id: 2, name: 'Sneha Patel', mobile: '9876543211', pan: 'FGHIJ5678K', aadhaar: 'XXXX-XXXX-5678', selfie: true,  submittedAt: '3 hours ago', status: 'pending', risk: 'low' },
  { id: 3, name: 'Amit Sharma', mobile: '9876543212', pan: 'KLMNO9012P', aadhaar: 'XXXX-XXXX-9012', selfie: false, submittedAt: '5 hours ago', status: 'pending', risk: 'high', notes: 'Selfie mismatch with PAN photo' },
  { id: 4, name: 'Priya Mehta', mobile: '9876543213', pan: 'PQRST3456U', aadhaar: 'XXXX-XXXX-3456', selfie: true,  submittedAt: '1 day ago',   status: 'pending', risk: 'medium', notes: 'Address mismatch: PAN has Mumbai, Aadhaar has Delhi' },
  { id: 5, name: 'Arjun Reddy', mobile: '9876543214', pan: 'UVWXY7890Z', aadhaar: 'XXXX-XXXX-7890', selfie: true,  submittedAt: '1 day ago',   status: 'pending', risk: 'low' },
  { id: 6, name: 'Deepa Iyer',  mobile: '9876543215', pan: 'ZABCD1234E', aadhaar: 'XXXX-XXXX-2345', selfie: true,  submittedAt: '2 days ago',  status: 'pending', risk: 'medium' },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const RISK_COLORS = {
  low: { color: '#0B6B4A', bg: '#E3F5EE' },
  medium: { color: '#9A6200', bg: '#FEF3DC' },
  high: { color: '#A02020', bg: '#FDEAEA' },
} as const;

export default function AdminKYCReviewScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [kycItems, setKycItems] = useState<KYCItem[]>(FALLBACK_KYC_QUEUE);
  const [selectedItem, setSelectedItem] = useState<KYCItem | null>(null);

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null,
    1500,
  );

  const handleApprove = (id: number) => {
    setKycItems((prev) => prev.map((item) => item.id === id ? { ...item, status: 'approved' as KYCStatus } : item));
    setSelectedItem(null);
    Alert.alert('KYC Approved', 'User has been verified successfully.');
  };

  const handleReject = (id: number) => {
    setKycItems((prev) => prev.map((item) => item.id === id ? { ...item, status: 'rejected' as KYCStatus } : item));
    setSelectedItem(null);
    Alert.alert('KYC Rejected', 'User has been notified with rejection reason.');
  };

  const filteredItems = kycItems.filter((item) => {
    if (activeFilter !== 'all' && item.status !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.mobile.includes(q);
    }
    return true;
  });
  const pendingCount = kycItems.filter((i) => i.status === 'pending').length;
  const approvedCount = kycItems.filter((i) => i.status === 'approved').length;
  const rejectedCount = kycItems.filter((i) => i.status === 'rejected').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>KYC Review</Text>
          <Text style={styles.topNavSub}>{pendingCount} pending verifications</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="search" size={22} color="#fff" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="funnel" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* ── Summary Stats ── */}
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.amber }]}>{pendingCount}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.green }]}>{approvedCount}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Approved</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.red }]}>{rejectedCount}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Rejected</Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.text3} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name or mobile..."
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

      {/* ── Filter Tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTab,
              { backgroundColor: activeFilter === tab.key ? colors.primary : colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterText, { color: activeFilter === tab.key ? '#fff' : colors.text2 }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : selectedItem ? (
          /* ── Detail View ── */
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Back button */}
            <Pressable onPress={() => setSelectedItem(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Back to list</Text>
            </Pressable>

            {/* User header */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailAvatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.detailAvatarText, { color: colors.primary }]}>{selectedItem.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailName, { color: colors.text }]}>{selectedItem.name}</Text>
                <Text style={[styles.detailMobile, { color: colors.text3 }]}>{selectedItem.mobile}</Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[selectedItem.risk].bg }]}>
                <Text style={[styles.riskText, { color: RISK_COLORS[selectedItem.risk].color }]}>{selectedItem.risk.toUpperCase()} RISK</Text>
              </View>
            </View>

            {/* Documents */}
            <View style={styles.docSection}>
              <Text style={[styles.docSectionLabel, { color: colors.text3 }]}>Submitted Documents</Text>
              <View style={[styles.docRow, { borderColor: colors.borderLight }]}>
                <Ionicons name="card" size={18} color={colors.text2} />
                <Text style={[styles.docLabel, { color: colors.text }]}>PAN Card</Text>
                <Text style={[styles.docValue, { color: colors.text3 }]}>{selectedItem.pan}</Text>
              </View>
              <View style={[styles.docRow, { borderColor: colors.borderLight }]}>
                <Ionicons name="id-card" size={18} color={colors.text2} />
                <Text style={[styles.docLabel, { color: colors.text }]}>Aadhaar</Text>
                <Text style={[styles.docValue, { color: colors.text3 }]}>{selectedItem.aadhaar}</Text>
              </View>
              <View style={[styles.docRow, { borderColor: colors.borderLight }]}>
                <Ionicons name="camera" size={18} color={colors.text2} />
                <Text style={[styles.docLabel, { color: colors.text }]}>Selfie</Text>
                <Text style={[styles.docValue, { color: selectedItem.selfie ? colors.green : colors.red }]}>
                  {selectedItem.selfie ? 'Uploaded' : 'Missing'}
                </Text>
              </View>
              <View style={[styles.docRow, { borderColor: colors.borderLight }]}>
                <Ionicons name="time" size={18} color={colors.text2} />
                <Text style={[styles.docLabel, { color: colors.text }]}>Submitted</Text>
                <Text style={[styles.docValue, { color: colors.text3 }]}>{selectedItem.submittedAt}</Text>
              </View>
              {selectedItem.notes && (
                <View style={[styles.noteBox, { backgroundColor: colors.amberBg, borderColor: colors.amber }]}>
                  <Ionicons name="alert-circle" size={16} color={colors.amber} />
                  <Text style={[styles.noteText, { color: colors.amber }]}>{selectedItem.notes}</Text>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionApprove, pressed && { opacity: 0.85 }]}
                onPress={() => handleApprove(selectedItem.id)}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.actionText}>Approve</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, styles.actionReject, pressed && { opacity: 0.85 }]}
                onPress={() => handleReject(selectedItem.id)}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
            </View>

            {/* Request resubmission */}
            <Pressable style={({ pressed }) => [styles.resubmitBtn, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.resubmitText, { color: colors.primary }]}>Request Resubmission</Text>
            </Pressable>
          </View>
        ) : (
          /* ── List View ── */
          filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.text3} />
              <Text style={[styles.emptyTitle, { color: colors.text2 }]}>All clear!</Text>
              <Text style={[styles.emptySub, { color: colors.text3 }]}>No KYC items in this filter.</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const rc = RISK_COLORS[item.risk];
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.kycCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { transform: [{ scale: 0.98 }] }]}
                  onPress={() => setSelectedItem(item)}
                >
                  <View style={styles.kycRow}>
                    <View style={[styles.kycAvatar, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.kycAvatarText, { color: colors.primary }]}>{item.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.kycNameRow}>
                        <Text style={[styles.kycName, { color: colors.text }]}>{item.name}</Text>
                        <View style={[styles.riskBadgeSmall, { backgroundColor: rc.bg }]}>
                          <Text style={[styles.riskBadgeText, { color: rc.color }]}>{item.risk}</Text>
                        </View>
                      </View>
                      <Text style={[styles.kycSub, { color: colors.text3 }]}>{item.mobile} · {item.submittedAt}</Text>
                      <View style={styles.kycDocRow}>
                        <Ionicons name="card-outline" size={13} color={colors.text3} />
                        <Text style={[styles.kycDocText, { color: colors.text3 }]}>PAN</Text>
                        <Ionicons name="id-card-outline" size={13} color={colors.text3} />
                        <Text style={[styles.kycDocText, { color: colors.text3 }]}>Aadhaar</Text>
                        {item.selfie && <Ionicons name="camera-outline" size={13} color={colors.green} />}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.text3} />
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
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, gap: spacing.smd,
  },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  statCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.lg, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: spacing.ssm, textTransform: 'uppercase', letterSpacing: 0.4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: spacing.xl + 2, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500' },
  filterScroll: { marginTop: spacing.md, marginBottom: spacing.xs },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterTab: { paddingHorizontal: spacing.xl4, paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  kycCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  kycRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  kycAvatar: { width: 42, height: 42, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  kycAvatarText: { fontSize: 14, fontWeight: '700' },
  kycNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  kycName: { fontWeight: '700', fontSize: 14 },
  kycSub: { fontSize: 11 },
  kycDocRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, marginTop: spacing.sm },
  kycDocText: { fontSize: 10, fontWeight: '500' },
  riskBadgeSmall: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full },
  riskBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl5 * 2 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: spacing.xl },
  emptySub: { fontSize: 13, marginTop: spacing.sm },
  detailCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.smd },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl4 },
  backText: { fontSize: 13, fontWeight: '600' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  detailAvatar: { width: 48, height: 48, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 16, fontWeight: '700' },
  detailName: { fontWeight: '700', fontSize: 16 },
  detailMobile: { fontSize: 12, marginTop: 2 },
  riskBadge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.ssm, borderRadius: radii.full },
  riskText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  docSection: { marginTop: spacing.xl4 },
  docSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.lg },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, paddingVertical: spacing.lg, borderBottomWidth: 1 },
  docLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  docValue: { fontSize: 12, fontWeight: '500' },
  noteBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.lg },
  noteText: { fontSize: 12, fontWeight: '500', flex: 1 },
  actionRow: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.xl4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl + 2, borderRadius: radii.sm },
  actionApprove: { backgroundColor: '#0B6B4A' },
  actionReject: { backgroundColor: '#A02020' },
  actionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  resubmitBtn: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.lg },
  resubmitText: { fontSize: 13, fontWeight: '600' },
});
