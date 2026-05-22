/**
 * RupeeFast — Admin Agent Management
 *
 * Layout:
 *   ┌─ Top Nav (title, search) ───────────────────────────┐
 *   ├─ Stat row (Total | Active | Pending | Inactive) ────┤
 *   ├─ Filter tabs ───────────────────────────────────────┤
 *   ├─ Agent cards (name, performance, territory) ───────┤
 *   └─ Detail view (info, metrics, tasks, actions) ──────┘
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

type AgentStatus = 'active' | 'pending' | 'inactive' | 'suspended';
type FilterTab = 'all' | AgentStatus;

interface AgentItem {
  id: number;
  name: string;
  mobile: string;
  status: AgentStatus;
  rating: number;
  territory: string;
  collected: number;
  target: number;
  visits: number;
  completed: number;
  borrowers: number;
  joinedAt: string;
  lastActive: string;
  tasksToday: number;
}

// ── Fallback data ──

const FALLBACK_AGENTS: AgentItem[] = [
  { id: 1, name: 'Sunil Verma',   mobile: '9876543221', status: 'active', rating: 4.8, territory: 'North Zone', collected: 32400, target: 40000, visits: 18, completed: 16, borrowers: 45, joinedAt: '6 months ago', lastActive: '10m ago', tasksToday: 5 },
  { id: 2, name: 'Vikas Yadav',   mobile: '9876543222', status: 'active', rating: 4.5, territory: 'East Zone',  collected: 28800, target: 35000, visits: 15, completed: 14, borrowers: 38, joinedAt: '5 months ago', lastActive: '25m ago', tasksToday: 4 },
  { id: 3, name: 'Anita Sharma',  mobile: '9876543223', status: 'active', rating: 4.2, territory: 'West Zone',  collected: 25200, target: 30000, visits: 14, completed: 12, borrowers: 32, joinedAt: '4 months ago', lastActive: '1h ago', tasksToday: 3 },
  { id: 4, name: 'Rahul Singh',   mobile: '9876543224', status: 'pending', rating: 0, territory: 'South Zone', collected: 0, target: 0, visits: 0, completed: 0, borrowers: 0, joinedAt: '2 days ago', lastActive: '1d ago', tasksToday: 0 },
  { id: 5, name: 'Priya Gupta',   mobile: '9876543225', status: 'active', rating: 3.5, territory: 'Central', collected: 14400, target: 25000, visits: 10, completed: 7, borrowers: 22, joinedAt: '2 months ago', lastActive: '2h ago', tasksToday: 2 },
  { id: 6, name: 'Amit Das',      mobile: '9876543226', status: 'inactive', rating: 4.0, territory: 'North East', collected: 18000, target: 30000, visits: 12, completed: 10, borrowers: 28, joinedAt: '3 months ago', lastActive: '2 weeks ago', tasksToday: 0 },
  { id: 7, name: 'Deepak Joshi',  mobile: '9876543227', status: 'suspended', rating: 2.5, territory: 'West Zone', collected: 6000, target: 20000, visits: 8, completed: 4, borrowers: 15, joinedAt: '1 month ago', lastActive: '1 week ago', tasksToday: 0 },
  { id: 8, name: 'Meena Iyer',    mobile: '9876543228', status: 'pending', rating: 0, territory: 'Unassigned', collected: 0, target: 0, visits: 0, completed: 0, borrowers: 0, joinedAt: '1 day ago', lastActive: '12h ago', tasksToday: 0 },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'suspended', label: 'Suspended' },
];

const STATUS_STYLES: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  active: { color: '#0B6B4A', bg: '#E3F5EE', label: 'Active' },
  pending: { color: '#9A6200', bg: '#FEF3DC', label: 'Pending Approval' },
  inactive: { color: '#6B7280', bg: '#F0F2F5', label: 'Inactive' },
  suspended: { color: '#A02020', bg: '#FDEAEA', label: 'Suspended' },
};

export default function AdminAgentsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>(FALLBACK_AGENTS);

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null, 1500,
  );

  const handleToggleStatus = (id: number, currentStatus: AgentStatus) => {
    const newStatus: AgentStatus = currentStatus === 'suspended' ? 'active' : currentStatus === 'pending' ? 'active' : 'suspended';
    setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status: newStatus } : a));
    setSelectedAgent(null);
    Alert.alert('Status Updated', `Agent has been ${newStatus === 'active' ? 'approved' : 'suspended'}.`);
  };

  const filteredAgents = agents.filter((a) => {
    if (activeFilter !== 'all' && a.status !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.mobile.includes(q) || a.territory.toLowerCase().includes(q);
    }
    return true;
  });

  const total = agents.length;
  const active = agents.filter((a) => a.status === 'active').length;
  const pending = agents.filter((a) => a.status === 'pending').length;
  const inactive = agents.filter((a) => a.status === 'inactive' || a.status === 'suspended').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Agent Management</Text>
          <Text style={styles.topNavSub}>{active} active agents</Text>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.text3} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search agents..."
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
          <Text style={[styles.statValue, { color: colors.amber }]}>{pending}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text3 }]}>{inactive}</Text>
          <Text style={[styles.statLabel, { color: colors.text3 }]}>Inactive</Text>
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
        ) : selectedAgent ? (
          /* ── Detail View ── */
          <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => setSelectedAgent(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.primary }]}>Back to agents</Text>
            </Pressable>

            <View style={styles.detailHeader}>
              <View style={[styles.detailAvatar, { backgroundColor: colors.amberBg }]}>
                <Text style={[styles.detailAvatarText, { color: colors.amber }]}>{selectedAgent.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailName, { color: colors.text }]}>{selectedAgent.name}</Text>
                <Text style={[styles.detailMobile, { color: colors.text3 }]}>{selectedAgent.mobile}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_STYLES[selectedAgent.status].bg }]}>
                <Text style={[styles.statusText, { color: STATUS_STYLES[selectedAgent.status].color }]}>{STATUS_STYLES[selectedAgent.status].label}</Text>
              </View>
            </View>

            {/* Performance metrics */}
            <View style={[styles.metricsBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: colors.text3 }]}>Collection Rate</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{selectedAgent.visits > 0 ? Math.round((selectedAgent.completed / selectedAgent.visits) * 100) : 0}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: colors.text3 }]}>Rating</Text>
                  <Text style={[styles.metricValue, { color: colors.amber }]}>{selectedAgent.rating > 0 ? selectedAgent.rating : 'N/A'}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: colors.text3 }]}>Borrowers</Text>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{selectedAgent.borrowers}</Text>
                </View>
              </View>
            </View>

            {/* Collected vs target */}
            <View style={styles.targetSection}>
              <View style={styles.targetRow}>
                <Text style={[styles.targetLabel, { color: colors.text3 }]}>Collection Progress</Text>
                <Text style={[styles.targetValue, { color: colors.text }]}>₹{selectedAgent.collected.toLocaleString('en-IN')} / ₹{selectedAgent.target.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${selectedAgent.target > 0 ? Math.min(100, Math.round((selectedAgent.collected / selectedAgent.target) * 100)) : 0}%`, backgroundColor: colors.amber }]} />
              </View>
            </View>

            {/* Details */}
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Territory</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, marginTop: spacing.ssm }}>
                  <Ionicons name="location" size={14} color={colors.text2} />
                  <Text style={[styles.infoValue, { color: colors.text }]}>{selectedAgent.territory}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Joined</Text>
                <Text style={[styles.infoValue, { color: colors.text, marginTop: spacing.ssm }]}>{selectedAgent.joinedAt}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Visits Today</Text>
                <Text style={[styles.infoValue, { color: colors.text, marginTop: spacing.ssm }]}>{selectedAgent.tasksToday}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.text3 }]}>Last Active</Text>
                <Text style={[styles.infoValue, { color: colors.text, marginTop: spacing.ssm }]}>{selectedAgent.lastActive}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              {(selectedAgent.status === 'pending' || selectedAgent.status === 'suspended') && (
                <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]} onPress={() => handleToggleStatus(selectedAgent.id, selectedAgent.status)}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Approve Agent</Text>
                </Pressable>
              )}
              {selectedAgent.status === 'active' && (
                <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }]} onPress={() => handleToggleStatus(selectedAgent.id, selectedAgent.status)}>
                  <Ionicons name="close-circle" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Suspend Agent</Text>
                </Pressable>
              )}
              <Pressable style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}>
                <Ionicons name="location-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Assign Territory</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── List View ── */
          filteredAgents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color={colors.text3} />
              <Text style={[styles.emptyTitle, { color: colors.text2 }]}>No agents found</Text>
              <Text style={[styles.emptySub, { color: colors.text3 }]}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            filteredAgents.map((agent, idx) => {
              const sc = STATUS_STYLES[agent.status];
              const pct = agent.target > 0 ? Math.round((agent.collected / agent.target) * 100) : 0;
              return (
                <Pressable
                  key={agent.id}
                  style={({ pressed }) => [styles.agentCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { transform: [{ scale: 0.98 }] }]}
                  onPress={() => setSelectedAgent(agent)}
                >
                  <View style={styles.agentHeader}>
                    <View style={[styles.agentAvatar, { backgroundColor: colors.amberBg }]}>
                      <Text style={[styles.agentAvatarText, { color: colors.amber }]}>{agent.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.agentNameRow}>
                        <Text style={[styles.agentName, { color: colors.text }]}>{agent.name}</Text>
                        <View style={[styles.agentStatusDot, { backgroundColor: sc.color }]} />
                      </View>
                      <Text style={[styles.agentTerritory, { color: colors.text3 }]}>{agent.territory}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.agentCollected, { color: colors.text }]}>₹{agent.collected.toLocaleString('en-IN')}</Text>
                      {agent.rating > 0 && (
                        <View style={[styles.ratingBadge, { backgroundColor: colors.amberBg }]}>
                          <Ionicons name="star" size={10} color={colors.amber} />
                          <Text style={[styles.ratingText, { color: colors.amber }]}>{agent.rating}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 90 ? colors.green : pct >= 70 ? colors.amber : colors.red }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={[styles.progressText, { color: colors.text3 }]}>{pct}% of target</Text>
                    <Text style={[styles.progressText, { color: colors.text3 }]}>{agent.completed}/{agent.visits} visits</Text>
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
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.smd, borderRadius: radii.xs, borderWidth: 1, paddingHorizontal: spacing.xl + 2, height: 40, gap: spacing.sm },
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
  agentCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  agentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  agentAvatar: { width: 42, height: 42, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  agentAvatarText: { fontSize: 14, fontWeight: '700' },
  agentNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  agentName: { fontWeight: '700', fontSize: 14 },
  agentTerritory: { fontSize: 11, marginTop: 2 },
  agentStatusDot: { width: 6, height: 6, borderRadius: 3 },
  agentCollected: { fontWeight: '700', fontSize: 14 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, marginTop: spacing.ssm },
  ratingText: { fontSize: 9, fontWeight: '700' },
  progressBar: { height: 4, backgroundColor: '#E2E5EC', borderRadius: 2, marginTop: spacing.xl, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressText: { fontSize: 10, fontWeight: '500' },
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
  statusText: { fontSize: 10, fontWeight: '700' },
  metricsBox: { borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl, marginTop: spacing.xl4 },
  metricsRow: { flexDirection: 'row' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: spacing.ssm },
  targetSection: { marginTop: spacing.xl4 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  targetValue: { fontSize: 13, fontWeight: '600' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xl4, gap: spacing.lg },
  infoItem: { width: '45%' },
  infoLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  actionRow: { gap: spacing.smd, marginTop: spacing.xl4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl + 2, borderRadius: radii.xs },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
