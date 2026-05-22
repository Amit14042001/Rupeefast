/**
 * RupeeFast — Admin User Management
 *
 * Layout:
 *   ┌─ Top Nav (title, search) ───────────────────────────┐
 *   ├─ Stat row (Total | Active | Blocked | Pending KYC) ─┤
 *   ├─ Filter tabs (All | Active | Blocked | Pending) ────┤
 *   ├─ User cards (avatar, name, mobile, status) ─────────┤
 *   └─ Detail view (info, KYC, loans, activity, actions) ─┘
 */

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

type UserStatus = 'active' | 'blocked' | 'pending_kyc';
type FilterTab = 'all' | UserStatus;

interface UserItem {
  id: number;
  name: string;
  mobile: string;
  status: UserStatus;
  kycStatus: 'verified' | 'pending' | 'rejected';
  role: 'borrower' | 'investor' | 'agent';
  joinedAt: string;
  loanCount: number;
  totalBorrowed: number;
  repaymentRate: number;
  lastActive: string;
}

// ── Fallback data ──

const FALLBACK_USERS: UserItem[] = [
  { id: 1, name: 'Ravi Kumar',   mobile: '9876543210', status: 'active', kycStatus: 'verified', role: 'borrower', joinedAt: '2 months ago', loanCount: 3, totalBorrowed: 18000, repaymentRate: 97, lastActive: '2m ago' },
  { id: 2, name: 'Sneha Patel',  mobile: '9876543211', status: 'active', kycStatus: 'verified', role: 'borrower', joinedAt: '1 month ago', loanCount: 1, totalBorrowed: 8000,  repaymentRate: 100, lastActive: '5m ago' },
  { id: 3, name: 'Amit Sharma',  mobile: '9876543212', status: 'pending_kyc', kycStatus: 'pending', role: 'borrower', joinedAt: '3 days ago', loanCount: 0, totalBorrowed: 0, repaymentRate: 0, lastActive: '1h ago' },
  { id: 4, name: 'Priya Mehta',  mobile: '9876543213', status: 'active', kycStatus: 'verified', role: 'investor', joinedAt: '2 weeks ago', loanCount: 0, totalBorrowed: 0, repaymentRate: 0, lastActive: '10m ago' },
  { id: 5, name: 'Arjun Reddy',  mobile: '9876543214', status: 'active', kycStatus: 'verified', role: 'borrower', joinedAt: '3 weeks ago', loanCount: 2, totalBorrowed: 12000, repaymentRate: 92, lastActive: '30m ago' },
  { id: 6, name: 'Deepa Iyer',   mobile: '9876543215', status: 'blocked', kycStatus: 'rejected', role: 'borrower', joinedAt: '1 month ago', loanCount: 1, totalBorrowed: 5000, repaymentRate: 60, lastActive: '2d ago' },
  { id: 7, name: 'Vikram Singh', mobile: '9876543216', status: 'active', kycStatus: 'verified', role: 'agent', joinedAt: '3 months ago', loanCount: 0, totalBorrowed: 0, repaymentRate: 0, lastActive: '15m ago' },
  { id: 8, name: 'Meera Joshi',  mobile: '9876543217', status: 'active', kycStatus: 'verified', role: 'investor', joinedAt: '1 month ago', loanCount: 0, totalBorrowed: 0, repaymentRate: 0, lastActive: '1h ago' },
  { id: 9, name: 'Rahul Verma',  mobile: '9876543218', status: 'pending_kyc', kycStatus: 'pending', role: 'borrower', joinedAt: '1 day ago', loanCount: 0, totalBorrowed: 0, repaymentRate: 0, lastActive: '30m ago' },
  { id: 10, name: 'Kavita Nair', mobile: '9876543219', status: 'active', kycStatus: 'verified', role: 'borrower', joinedAt: '2 months ago', loanCount: 2, totalBorrowed: 15000, repaymentRate: 95, lastActive: '1h ago' },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'pending_kyc', label: 'Pending KYC' },
];

const STATUS_STYLES: Record<UserStatus, { color: string; bg: string; label: string }> = {
  active: { color: '#0B6B4A', bg: '#E3F5EE', label: 'Active' },
  blocked: { color: '#A02020', bg: '#FDEAEA', label: 'Blocked' },
  pending_kyc: { color: '#9A6200', bg: '#FEF3DC', label: 'Pending KYC' },
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  borrower: 'person-outline',
  investor: 'trending-up-outline',
  agent: 'location-outline',
};

export default function AdminUsersScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [users, setUsers] = useState<UserItem[]>(FALLBACK_USERS);

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null, 1500,
  );

  const handleToggleBlock = (id: number, currentStatus: UserStatus) => {
    const newStatus: UserStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: newStatus } : u));
    setSelectedUser(null);
    Alert.alert(newStatus === 'active' ? 'User Activated' : 'User Blocked', `User has been ${newStatus === 'active' ? 'activated' : 'blocked'} successfully.`);
  };

  const filteredUsers = users.filter((u) => {
    if (activeFilter !== 'all' && u.status !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.mobile.includes(q);
    }
    return true;
  });

  const total = users.length;
  const active = users.filter((u) => u.status === 'active').length;
  const blocked = users.filter((u) => u.status === 'blocked').length;
  const pendingKyc = users.filter((u) => u.status === 'pending_kyc').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>User Management</Text>
          <Text style={styles.topNavSub}>{total} total users</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="download-outline" size={22} color="#fff" />
        </Pressable>
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

      {/* ── Stats Row ── */}
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{total}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.green }]}>{active}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Active</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.amber }]}>{pendingKyc}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Pending KYC</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.red }]}>{blocked}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Blocked</Text>
        </View>
      </View>

      {/* ── Filter Tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.filterTab, { backgroundColor: activeFilter === tab.key ? colors.primary : colors.surface, borderColor: colors.border }]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterText, { color: activeFilter === tab.key ? '#fff' : colors.text2 }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : selectedUser ? (
          /* ── Detail View ── */
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => setSelectedUser(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Back to users</Text>
            </Pressable>

            {/* User header */}
            <View style={styles.detailHeader}>
              <View style={[styles.detailAvatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.detailAvatarText, { color: colors.primary }]}>{selectedUser.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailName, { color: colors.text }]}>{selectedUser.name}</Text>
                <Text style={[styles.detailMobile, { color: colors.text3 }]}>{selectedUser.mobile}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_STYLES[selectedUser.status].bg }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_STYLES[selectedUser.status].color }]}>{STATUS_STYLES[selectedUser.status].label}</Text>
              </View>
            </View>

            {/* Quick info grid */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Role</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>KYC Status</Text>
                <Text style={[styles.infoValue, { color: selectedUser.kycStatus === 'verified' ? colors.green : selectedUser.kycStatus === 'rejected' ? colors.red : colors.amber }]}>{selectedUser.kycStatus}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Joined</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{selectedUser.joinedAt}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Last Active</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{selectedUser.lastActive}</Text>
              </View>
            </View>

            {/* Financial stats */}
            <View style={[styles.financeBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.text3 }]}>Loans Taken</Text>
                <Text style={[styles.financeValue, { color: colors.text }]}>{selectedUser.loanCount}</Text>
              </View>
              <View style={styles.financeDivider} />
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.text3 }]}>Total Borrowed</Text>
                <Text style={[styles.financeValue, { color: colors.text }]}>₹{selectedUser.totalBorrowed.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.financeDivider} />
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.text3 }]}>Repayment Rate</Text>
                <Text style={[styles.financeValue, { color: selectedUser.repaymentRate >= 90 ? colors.green : colors.amber }]}>{selectedUser.repaymentRate}%</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}>
                <Ionicons name="notifications-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Notify</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.purple }, pressed && { opacity: 0.85 }]}>
                <Ionicons name="shield-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>KYC Check</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: selectedUser.status === 'blocked' ? colors.green : colors.red }, pressed && { opacity: 0.85 }]}
                onPress={() => handleToggleBlock(selectedUser.id, selectedUser.status)}
              >
                <Ionicons name={selectedUser.status === 'blocked' ? 'checkmark-circle' : 'close-circle'} size={16} color="#fff" />
                <Text style={styles.actionBtnText}>{selectedUser.status === 'blocked' ? 'Activate' : 'Block'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── List View ── */
          filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.text3} />
              <Text style={[styles.emptyTitle, { color: colors.text2 }]}>No users found</Text>
              <Text style={[styles.emptySub, { color: colors.text3 }]}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            filteredUsers.map((user) => {
              const sc = STATUS_STYLES[user.status];
              return (
                <Pressable
                  key={user.id}
                  style={({ pressed }) => [styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { transform: [{ scale: 0.98 }] }]}
                  onPress={() => setSelectedUser(user)}
                >
                  <View style={styles.userRow}>
                    <View style={[styles.userAvatar, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.userAvatarText, { color: colors.primary }]}>{user.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.userNameRow}>
                        <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
                        <Ionicons name={ROLE_ICONS[user.role] || 'person-outline'} size={13} color={colors.text3} />
                      </View>
                      <Text style={[styles.userMobile, { color: colors.text3 }]}>{user.mobile}</Text>
                      <View style={styles.userMetaRow}>
                        <View style={[styles.userStatusDot, { backgroundColor: sc.color }]} />
                        <Text style={[styles.userStatusText, { color: sc.color }]}>{sc.label}</Text>
                        {user.loanCount > 0 && (
                          <>
                            <Text style={[styles.userMetaDot, { color: colors.text3 }]}>·</Text>
                            <Text style={[styles.userLoans, { color: colors.text3 }]}>{user.loanCount} loans</Text>
                          </>
                        )}
                        <Text style={[styles.userMetaDot, { color: colors.text3 }]}>·</Text>
                        <Text style={[styles.userLastActive, { color: colors.text3 }]}>{user.lastActive}</Text>
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
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.smd },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.smd, borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: spacing.xl + 2, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500' },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md },
  statCard: { flex: 1, borderRadius: radii.xs, borderWidth: 1, padding: spacing.lg, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', marginTop: spacing.ssm, textTransform: 'uppercase', letterSpacing: 0.3 },
  filterScroll: { marginTop: spacing.md, marginBottom: spacing.xs },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterTab: { paddingHorizontal: spacing.xl4, paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  userCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  userAvatar: { width: 42, height: 42, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 14, fontWeight: '700' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  userName: { fontWeight: '700', fontSize: 14 },
  userMobile: { fontSize: 11, marginTop: 2 },
  userMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, marginTop: spacing.sm },
  userStatusDot: { width: 6, height: 6, borderRadius: 3 },
  userStatusText: { fontSize: 10, fontWeight: '700' },
  userMetaDot: { fontSize: 10 },
  userLoans: { fontSize: 10, fontWeight: '500' },
  userLastActive: { fontSize: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl5 * 2 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: spacing.xl },
  emptySub: { fontSize: 13, marginTop: spacing.sm },
  detailCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.smd },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl4 },
  backText: { fontSize: 13, fontWeight: '600' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  detailAvatar: { width: 48, height: 48, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 16, fontWeight: '700' },
  detailName: { fontWeight: '700', fontSize: 16 },
  detailMobile: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xl4, gap: spacing.lg },
  infoItem: { width: '45%' },
  infoLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 14, fontWeight: '600', marginTop: spacing.ssm },
  financeBox: { flexDirection: 'row', borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl, marginTop: spacing.xl4 },
  financeItem: { flex: 1, alignItems: 'center' },
  financeDivider: { width: 1, backgroundColor: '#E2E5EC', marginVertical: spacing.sm },
  financeLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  financeValue: { fontSize: 14, fontWeight: '700', marginTop: spacing.ssm },
  actionRow: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.xl4 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl + 2, borderRadius: radii.xs },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
