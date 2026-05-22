/**
 * RupeeFast — Admin Collections Management (Migration 008 Enhanced)
 *
 * Uses the full CollectionLog type with fields:
 *   collection_type, contacted_person, relationship, contact_method,
 *   amount_collected, amount_promised, promise_date, outcome,
 *   location_lat/lng, duration_minutes, notes, attachments
 *
 * Layout:
 *   ┌─ Top Nav (title, export, calendar) ─────────────────┐
 *   ├─ Metric Cards (Collected | Pending | Overdue | Rate)│
 *   ├─ Tab Switcher (Agents | Overdue | Logs) ────────────┤
 *   ├─ Tab Content ───────────────────────────────────────┤
 *   └─ Bottom tab nav ────────────────────────────────────┘
 */

import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';
import { updateCollectionLog } from '../../src/services/collections';
import type {
  CollectionLog,
  CollectionType,
  CollectionStatus,
  CollectionOutcome,
  ContactRelationship,
  ContactMethod,
} from '../../src/types';

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const COLLECTION_TYPE_CONFIG: Record<CollectionType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  field_visit:     { icon: 'walk-outline',    label: 'Field Visit' },
  phone_call:      { icon: 'call-outline',      label: 'Phone Call' },
  legal_notice:    { icon: 'document-text-outline', label: 'Legal Notice' },
  sms_reminder:    { icon: 'chatbubble-outline', label: 'SMS Reminder' },
  email_reminder:  { icon: 'mail-outline',     label: 'Email Reminder' },
  home_visit:      { icon: 'home-outline',     label: 'Home Visit' },
  workplace_visit: { icon: 'briefcase-outline', label: 'Workplace Visit' },
};

const OUTCOME_CONFIG: Record<CollectionOutcome, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string }> = {
  no_response:     { icon: 'close-circle-outline',  label: 'No Response',     color: '#9CA3AF', bg: '#F3F4F6' },
  promise_to_pay:  { icon: 'hand-left-outline',     label: 'Promise to Pay', color: '#9A6200', bg: '#FEF3DC' },
  partial_payment: { icon: 'wallet-outline',        label: 'Partial Payment',color: '#2562A8', bg: '#EBF2FB' },
  full_payment:    { icon: 'checkmark-circle',      label: 'Full Payment',   color: '#0B6B4A', bg: '#E3F5EE' },
  dispute:         { icon: 'alert-circle-outline',  label: 'Dispute',        color: '#D44040', bg: '#FEF0F0' },
  refused:         { icon: 'hand-left-outline',     label: 'Refused',        color: '#A02020', bg: '#FDEAEA' },
  not_home:        { icon: 'home-outline',          label: 'Not Home',       color: '#9CA3AF', bg: '#F3F4F6' },
  wrong_address:   { icon: 'location-outline',      label: 'Wrong Address',  color: '#9CA3AF', bg: '#F3F4F6' },
  deceased:        { icon: 'heart-dislike-outline', label: 'Deceased',       color: '#6B7280', bg: '#F3F4F6' },
  legal_referral:  { icon: 'shield-outline',        label: 'Legal Referral', color: '#5A3E9B', bg: '#F0EBFF' },
};

const STATUS_CONFIG: Record<CollectionStatus, { label: string; color: string; bg: string }> = {
  scheduled:    { label: 'Scheduled',   color: '#2562A8', bg: '#EBF2FB' },
  in_progress:  { label: 'In Progress', color: '#9A6200', bg: '#FEF3DC' },
  completed:    { label: 'Completed',   color: '#0B6B4A', bg: '#E3F5EE' },
  skipped:      { label: 'Skipped',     color: '#9CA3AF', bg: '#F3F4F6' },
  cancelled:    { label: 'Cancelled',   color: '#A02020', bg: '#FDEAEA' },
};

const CONTACT_METHOD_CONFIG: Record<ContactMethod, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  in_person:   { icon: 'people-outline',  label: 'In Person' },
  phone:       { icon: 'call-outline',    label: 'Phone' },
  sms:         { icon: 'chatbubble-outline', label: 'SMS' },
  email:       { icon: 'mail-outline',    label: 'Email' },
  third_party: { icon: 'share-outline',   label: 'Third Party' },
};

const RELATIONSHIP_CONFIG: Record<ContactRelationship, { label: string }> = {
  self:     { label: 'Self' },
  spouse:   { label: 'Spouse' },
  parent:   { label: 'Parent' },
  neighbor: { label: 'Neighbor' },
  employer: { label: 'Employer' },
  guarantor: { label: 'Guarantor' },
  other:    { label: 'Other' },
};

/** Editable fields for a collection log */
type EditableFields = Partial<Pick<CollectionLog, 'status' | 'outcome' | 'amount_collected' | 'amount_promised' | 'promise_date' | 'notes' | 'duration_minutes' | 'contact_method'>>;

// ══════════════════════════════════════════════════════════════
// FALLBACK DATA
// ══════════════════════════════════════════════════════════════

const FALLBACK_COLLECTION_METRICS = [
  { label: 'Collected Today', value: '₹2,16,000', change: '+18%', icon: 'trending-up' as const, color: '#0B6B4A' as const },
  { label: 'Pending Today',  value: '₹84,000',   change: '-12%', icon: 'time' as const,        color: '#9A6200' as const },
  { label: 'Overdue',        value: '₹1,42,500', change: '+5%',  icon: 'alert' as const,       color: '#A02020' as const },
  { label: 'Recovery Rate',  value: '72%',       change: '+3%',  icon: 'pulse' as const,       color: '#2562A8' as const },
];

const FALLBACK_AGENTS = [
  { id: 1, name: 'Sunil Verma',   collected: 32400, target: 40000, visits: 18, completed: 16, rating: 4.8 },
  { id: 2, name: 'Vikas Yadav',   collected: 28800, target: 35000, visits: 15, completed: 14, rating: 4.5 },
  { id: 3, name: 'Anita Sharma',  collected: 25200, target: 30000, visits: 14, completed: 12, rating: 4.2 },
  { id: 4, name: 'Rahul Singh',   collected: 18000, target: 30000, visits: 12, completed: 9,  rating: 3.8 },
  { id: 5, name: 'Priya Gupta',   collected: 14400, target: 25000, visits: 10, completed: 7,  rating: 3.5 },
];

const FALLBACK_OVERDUE_LOANS = [
  { id: 1, name: 'Ravi Kumar',  amount: 720, days: 6,  plan: 'Daily',   agent: 'Sunil Verma',   risk: 'high' as const },
  { id: 2, name: 'Amit Sharma', amount: 1440, days: 12, plan: 'Daily',   agent: 'Vikas Yadav',   risk: 'high' as const },
  { id: 3, name: 'Sneha Patel', amount: 600, days: 3,  plan: 'Weekly',  agent: 'Anita Sharma',  risk: 'medium' as const },
  { id: 4, name: 'Deepa Iyer',  amount: 900, days: 5,  plan: 'Weekly',  agent: 'Rahul Singh',   risk: 'medium' as const },
  { id: 5, name: 'Arjun Reddy', amount: 1800, days: 18, plan: 'Monthly', agent: 'Priya Gupta',   risk: 'high' as const },
];

const RISK_STYLES: Record<string, { color: string; bg: string }> = {
  high:   { color: '#A02020', bg: '#FDEAEA' },
  medium: { color: '#9A6200', bg: '#FEF3DC' },
  low:    { color: '#0B6B4A', bg: '#E3F5EE' },
};

/** Mock collection logs — matching Migration 008 CollectionLog type */
const FALLBACK_COLLECTION_LOGS: CollectionLog[] = [
  {
    id: 1, loan_id: 101, agent_id: 1,
    collection_type: 'home_visit', status: 'completed', outcome: 'full_payment',
    contacted_person: 'Ravi Kumar', relationship: 'self', contact_method: 'in_person',
    amount_collected: 720, notes: 'Paid in full — cash. Cooperative customer.',
    location_lat: 28.6128, location_lng: 77.2314, duration_minutes: 18,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2, loan_id: 102, agent_id: 2,
    collection_type: 'phone_call', status: 'completed', outcome: 'promise_to_pay',
    contacted_person: 'Amit Sharma', relationship: 'self', contact_method: 'phone',
    amount_promised: 1440, promise_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Customer requested 2-day extension. Promised to pay by Friday.',
    duration_minutes: 12,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3, loan_id: 103, agent_id: 1,
    collection_type: 'sms_reminder', status: 'completed', outcome: 'no_response',
    contact_method: 'sms',
    notes: 'Sent automated SMS reminder. No response yet. Follow up in 24h.',
    duration_minutes: 2,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4, loan_id: 104, agent_id: 3,
    collection_type: 'workplace_visit', status: 'in_progress', outcome: 'partial_payment',
    contacted_person: 'Sneha Patel', relationship: 'self', contact_method: 'in_person',
    amount_collected: 300, amount_promised: 300, promise_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Partial payment collected at workplace. Balance promised tomorrow.',
    location_lat: 28.5678, location_lng: 77.2845, duration_minutes: 24,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5, loan_id: 105, agent_id: 4,
    collection_type: 'field_visit', status: 'scheduled', outcome: 'not_home',
    contacted_person: 'Neighbor', relationship: 'neighbor', contact_method: 'in_person',
    notes: 'Knocked 3 times. Spoke with neighbor — customer left for work early. Will try evening.',
    location_lat: 28.5892, location_lng: 77.3217, duration_minutes: 8,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 6, loan_id: 106, agent_id: 5,
    collection_type: 'legal_notice', status: 'completed', outcome: 'legal_referral',
    contacted_person: 'Deepa Iyer', relationship: 'self', contact_method: 'in_person',
    notes: 'Customer refused to pay. Handed legal notice. Case referred to legal team.',
    duration_minutes: 15,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 7, loan_id: 107, agent_id: 2,
    collection_type: 'phone_call', status: 'completed', outcome: 'dispute',
    contacted_person: 'Arjun Reddy', relationship: 'self', contact_method: 'phone',
    notes: 'Customer claims he already paid via UPI. Transaction reference shared — needs verification.',
    duration_minutes: 18,
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
  },
];

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Options for pickers — arrays of { key, label } */
const STATUS_PICKER_OPTIONS: Array<{ key: CollectionStatus; label: string }> = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'cancelled', label: 'Cancelled' },
];

const OUTCOME_PICKER_OPTIONS: Array<{ key: CollectionOutcome; label: string }> = [
  { key: 'no_response', label: 'No Response' },
  { key: 'promise_to_pay', label: 'Promise to Pay' },
  { key: 'partial_payment', label: 'Partial Payment' },
  { key: 'full_payment', label: 'Full Payment' },
  { key: 'dispute', label: 'Dispute' },
  { key: 'refused', label: 'Refused' },
  { key: 'not_home', label: 'Not Home' },
  { key: 'wrong_address', label: 'Wrong Address' },
  { key: 'deceased', label: 'Deceased' },
  { key: 'legal_referral', label: 'Legal Referral' },
];

const CONTACT_METHOD_PICKER_OPTIONS: Array<{ key: ContactMethod; label: string }> = [
  { key: 'in_person', label: 'In Person' },
  { key: 'phone', label: 'Phone' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'third_party', label: 'Third Party' },
];

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function AdminCollectionsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [selectedTab, setSelectedTab] = useState<'agents' | 'overdue' | 'logs'>('agents');
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [agents] = useState(FALLBACK_AGENTS);
  const [overdueLoans] = useState(FALLBACK_OVERDUE_LOANS);

  // ── Collection Logs State ──
  const [logs, setLogs] = useState<CollectionLog[]>(FALLBACK_COLLECTION_LOGS);
  const [selectedLog, setSelectedLog] = useState<CollectionLog | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<EditableFields>({});
  const [saving, setSaving] = useState<number | null>(null);

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null,
    1500,
  );

  // ── Log Handlers ──

  const enterEditMode = () => {
    setEditFields({
      status: selectedLog?.status,
      outcome: selectedLog?.outcome,
      amount_collected: selectedLog?.amount_collected,
      amount_promised: selectedLog?.amount_promised,
      promise_date: selectedLog?.promise_date,
      notes: selectedLog?.notes,
      duration_minutes: selectedLog?.duration_minutes,
      contact_method: selectedLog?.contact_method,
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditFields({});
  };

  const handleSave = async () => {
    if (!selectedLog) return;
    setSaving(selectedLog.id);
    try {
      const result = await updateCollectionLog(selectedLog.id, editFields);
      if (result.success) {
        setLogs((prev) => prev.map((l) =>
          l.id === selectedLog.id
            ? { ...l, ...editFields, updated_at: new Date().toISOString() }
            : l,
        ));
        setSelectedLog((prev) => prev ? { ...prev, ...editFields, updated_at: new Date().toISOString() } : null);
        setEditMode(false);
        Alert.alert('Saved', 'Collection log updated successfully.');
      } else {
        Alert.alert('Error', result.error || 'Failed to update log.');
      }
    } finally {
      setSaving(null);
    }
  };

  const handleFieldUpdate = <K extends keyof EditableFields>(key: K, value: EditableFields[K]) => {
    setEditFields((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.green }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Collections</Text>
          <Text style={styles.topNavSub}>Recovery Operations</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="download-outline" size={22} color="#fff" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="calendar-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : (
          <>
            {/* ── Metric Cards ── */}
            <View style={styles.metricGrid}>
              {FALLBACK_COLLECTION_METRICS.map((m, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <View style={[styles.metricIcon, { backgroundColor: `${m.color}15` }]}>
                    <Ionicons name={m.icon} size={18} color={m.color} />
                  </View>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{m.value}</Text>
                  <View style={styles.metricRow}>
                    <Text style={[styles.metricLabel, { color: colors.text3 }]}>{m.label}</Text>
                    <Text style={[styles.metricChange, { color: m.change.startsWith('+') ? colors.green : colors.red }]}>{m.change}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* ── Tab Switcher (Agents | Overdue | Logs) ── */}
            <View style={[styles.tabRow, { borderColor: colors.border }]}>
              <Pressable
                style={[styles.tab, selectedTab === 'agents' && { backgroundColor: colors.primary }]}
                onPress={() => { setSelectedTab('agents'); setSelectedLog(null); setEditMode(false); }}
              >
                <Text style={[styles.tabText, { color: selectedTab === 'agents' ? '#fff' : colors.text2 }]}>Agents</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, selectedTab === 'overdue' && { backgroundColor: colors.red }]}
                onPress={() => { setSelectedTab('overdue'); setSelectedLog(null); setEditMode(false); }}
              >
                <Text style={[styles.tabText, { color: selectedTab === 'overdue' ? '#fff' : colors.text2 }]}>Overdue</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, selectedTab === 'logs' && { backgroundColor: colors.green }]}
                onPress={() => { setSelectedTab('logs'); setSelectedLog(null); setEditMode(false); }}
              >
                <Text style={[styles.tabText, { color: selectedTab === 'logs' ? '#fff' : colors.text2 }]}>Logs</Text>
              </Pressable>
            </View>

            {selectedTab === 'agents' && <AgentsTab agents={agents} expandedAgent={expandedAgent} setExpandedAgent={setExpandedAgent} colors={colors} />}
            {selectedTab === 'overdue' && <OverdueTab overdueLoans={overdueLoans} colors={colors} />}
            {selectedTab === 'logs' && (
              selectedLog ? (
                <CollectionLogDetail
                  log={selectedLog}
                  editMode={editMode}
                  editFields={editFields}
                  saving={saving}
                  onBack={() => { setSelectedLog(null); setEditMode(false); }}
                  onEdit={enterEditMode}
                  onCancelEdit={cancelEdit}
                  onSave={handleSave}
                  onFieldUpdate={handleFieldUpdate}
                  colors={colors}
                />
              ) : (
                <CollectionLogList
                  logs={logs}
                  onSelect={(log) => setSelectedLog(log)}
                  colors={colors}
                />
              )
            )}

            <View style={{ height: spacing.xl5 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// AGENTS TAB
// ══════════════════════════════════════════════════════════════

function AgentsTab({ agents, expandedAgent, setExpandedAgent, colors }: {
  agents: typeof FALLBACK_AGENTS;
  expandedAgent: number | null;
  setExpandedAgent: (id: number | null) => void;
  colors: any;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Field Agents · {agents.length} active</Text>
      </View>
      {agents.map((agent, idx) => {
        const pct = Math.round((agent.collected / agent.target) * 100);
        const barColor = pct >= 90 ? colors.green : pct >= 70 ? colors.amber : colors.red;
        const isExpanded = expandedAgent === agent.id;
        return (
          <Pressable
            key={agent.id}
            style={({ pressed }) => [styles.agentCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.95 }]}
            onPress={() => setExpandedAgent(isExpanded ? null : agent.id)}
          >
            <View style={styles.agentHeader}>
              <View style={[styles.agentRank, { backgroundColor: idx < 3 ? colors.primaryBg : colors.bg }]}>
                <Text style={[styles.agentRankText, { color: idx < 3 ? colors.primary : colors.text3 }]}>#{idx + 1}</Text>
              </View>
              <View style={[styles.agentAvatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.agentAvatarText, { color: colors.primary }]}>{agent.name.split(' ').map(n => n[0]).join('')}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.agentName, { color: colors.text }]}>{agent.name}</Text>
                <Text style={[styles.agentMeta, { color: colors.text3 }]}>{agent.completed}/{agent.visits} visits completed</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.agentCollected, { color: colors.text }]}>₹{agent.collected.toLocaleString('en-IN')}</Text>
                <View style={[styles.ratingBadge, { backgroundColor: colors.amberBg }]}>
                  <Ionicons name="star" size={10} color={colors.amber} />
                  <Text style={[styles.ratingText, { color: colors.amber }]}>{agent.rating}</Text>
                </View>
              </View>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressText, { color: colors.text3 }]}>₹{agent.collected.toLocaleString('en-IN')} of ₹{agent.target.toLocaleString('en-IN')}</Text>
              <Text style={[styles.progressPct, { color: barColor }]}>{pct}%</Text>
            </View>

            {isExpanded && (
              <View style={[styles.expandedSection, { borderTopColor: colors.borderLight }]}>
                <View style={styles.expandedRow}>
                  <View style={styles.expandedItem}>
                    <Text style={[styles.expandedLabel, { color: colors.text3 }]}>Collection Rate</Text>
                    <Text style={[styles.expandedValue, { color: colors.text }]}>{Math.round((agent.completed / agent.visits) * 100)}%</Text>
                  </View>
                  <View style={styles.expandedItem}>
                    <Text style={[styles.expandedLabel, { color: colors.text3 }]}>Avg per Visit</Text>
                    <Text style={[styles.expandedValue, { color: colors.text }]}>₹{Math.round(agent.collected / agent.visits)}</Text>
                  </View>
                  <View style={styles.expandedItem}>
                    <Text style={[styles.expandedLabel, { color: colors.text3 }]}>Shortfall</Text>
                    <Text style={[styles.expandedValue, { color: colors.red }]}>₹{(agent.target - agent.collected).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// OVERDUE TAB
// ══════════════════════════════════════════════════════════════

function OverdueTab({ overdueLoans, colors }: {
  overdueLoans: typeof FALLBACK_OVERDUE_LOANS;
  colors: any;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Overdue Loans · {overdueLoans.length} loans</Text>
      </View>
      {overdueLoans.map((loan) => {
        const rs = RISK_STYLES[loan.risk];
        return (
          <Pressable
            key={loan.id}
            style={({ pressed }) => [styles.loanCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.loanRow}>
              <View style={[styles.loanIcon, { backgroundColor: loan.days > 7 ? colors.redBg : colors.amberBg }]}>
                <Ionicons name={loan.days > 7 ? 'alert-circle' : 'time-outline'} size={20} color={loan.days > 7 ? colors.red : colors.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.loanNameRow}>
                  <Text style={[styles.loanName, { color: colors.text }]}>{loan.name}</Text>
                  <View style={[styles.loanRiskBadge, { backgroundColor: rs.bg }]}>
                    <Text style={[styles.loanRiskText, { color: rs.color }]}>{loan.risk}</Text>
                  </View>
                </View>
                <View style={styles.loanMetaRow}>
                  <Text style={[styles.loanMeta, { color: colors.text3 }]}>{loan.plan} plan · Agent: {loan.agent}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.loanAmount, { color: colors.red }]}>₹{loan.amount}</Text>
                <View style={[styles.loanDaysBadge, { backgroundColor: loan.days > 7 ? colors.redBg : colors.amberBg }]}>
                  <Text style={[styles.loanDaysText, { color: loan.days > 7 ? colors.red : colors.amber }]}>{loan.days}d overdue</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// COLLECTION LOG LIST VIEW
// ══════════════════════════════════════════════════════════════

function CollectionLogList({ logs, onSelect, colors }: {
  logs: CollectionLog[];
  onSelect: (log: CollectionLog) => void;
  colors: any;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Collection Logs · {logs.length} entries</Text>
      </View>
      {logs.map((log) => {
        const tc = COLLECTION_TYPE_CONFIG[log.collection_type];
        const sc = STATUS_CONFIG[log.status];
        const oc = log.outcome ? OUTCOME_CONFIG[log.outcome] : null;
        return (
          <Pressable
            key={log.id}
            style={({ pressed }) => [styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: sc.color }, pressed && { opacity: 0.92 }]}
            onPress={() => onSelect(log)}
          >
            <View style={styles.logRow}>
              {/* Type icon */}
              <View style={[styles.logTypeIcon, { backgroundColor: `${sc.color}15` }]}>
                <Ionicons name={tc.icon} size={18} color={sc.color} />
              </View>
              <View style={{ flex: 1 }}>
                {/* Top row: type + status badge */}
                <View style={styles.logTopRow}>
                  <Text style={[styles.logType, { color: colors.text }]}>{tc.label}</Text>
                  <View style={[styles.logStatusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.logStatusText, { color: sc.color }]}>{sc.label}</Text>
                  </View>
                </View>
                {/* Contact info */}
                <Text style={[styles.logContact, { color: colors.text3 }]} numberOfLines={1}>
                  {log.contacted_person || '—'} · {log.contact_method ? CONTACT_METHOD_CONFIG[log.contact_method].label : '-'}
                </Text>
                {/* Bottom row: outcome + amount + time */}
                <View style={styles.logMetaRow}>
                  {oc && (
                    <View style={[styles.logOutcomeBadge, { backgroundColor: oc.bg }]}>
                      <Ionicons name={oc.icon} size={10} color={oc.color} />
                      <Text style={[styles.logOutcomeText, { color: oc.color }]}>{oc.label}</Text>
                    </View>
                  )}
                  {log.amount_collected != null && (
                    <Text style={[styles.logAmount, { color: colors.green }]}>₹{log.amount_collected}</Text>
                  )}
                  <Text style={[styles.logTime, { color: colors.text3 }]}>{formatAge(log.created_at)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.text3} />
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// COLLECTION LOG DETAIL + EDIT VIEW
// ══════════════════════════════════════════════════════════════

function CollectionLogDetail({
  log, editMode, editFields, saving, onBack, onEdit, onCancelEdit, onSave, onFieldUpdate, colors,
}: {
  log: CollectionLog;
  editMode: boolean;
  editFields: EditableFields;
  saving: number | null;
  onBack: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onFieldUpdate: <K extends keyof EditableFields>(key: K, value: EditableFields[K]) => void;
  colors: any;
}) {
  const tc = COLLECTION_TYPE_CONFIG[log.collection_type];
  const sc = STATUS_CONFIG[editMode && editFields.status ? editFields.status : log.status];
  const oc = editMode && editFields.outcome ? OUTCOME_CONFIG[editFields.outcome] : log.outcome ? OUTCOME_CONFIG[log.outcome] : null;
  const isSaving = saving === log.id;

  return (
    <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Back button */}
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Back to logs</Text>
      </Pressable>

      {/* Status badge */}
      <View style={[styles.detailStatusBadge, { backgroundColor: sc.bg }]}>
        <Ionicons name={tc.icon} size={16} color={sc.color} />
        <Text style={[styles.detailStatusText, { color: sc.color }]}>{sc.label}</Text>
      </View>

      {/* Collection type */}
      <Text style={[styles.detailType, { color: colors.text }]}>{tc.label}</Text>
      <Text style={[styles.detailLoanId, { color: colors.text3 }]}>Loan #{log.loan_id} · Agent #{log.agent_id}</Text>

      {/* Detail fields grid */}
      <View style={[styles.detailGrid, { borderColor: colors.borderLight }]}>
        {/* Contacted Person */}
        {log.contacted_person && (
          <DetailField icon="person-outline" label="Contacted" value={log.contacted_person} colors={colors} />
        )}
        {/* Relationship */}
        {log.relationship && (
          <DetailField icon="people-outline" label="Relationship" value={RELATIONSHIP_CONFIG[log.relationship]?.label || log.relationship} colors={colors} />
        )}
        {/* Contact method */}
        {log.contact_method && (
          <DetailField icon={CONTACT_METHOD_CONFIG[log.contact_method]?.icon || 'call-outline'} label="Method" value={CONTACT_METHOD_CONFIG[log.contact_method]?.label || log.contact_method} colors={colors} />
        )}
        {/* Duration */}
        <DetailField icon="time-outline" label="Duration" value={log.duration_minutes ? `${log.duration_minutes} min` : '-'} colors={colors} />
        {/* Location */}
        {log.location_lat != null && log.location_lng != null && (
          <DetailField icon="location-outline" label="GPS" value={`${log.location_lat.toFixed(4)}, ${log.location_lng.toFixed(4)}`} colors={colors} />
        )}
        {/* Created */}
        <DetailField icon="time-outline" label="Logged" value={formatAge(log.created_at)} colors={colors} />
        {/* Updated */}
        <DetailField icon="refresh-outline" label="Updated" value={formatAge(log.updated_at)} colors={colors} />
      </View>

      {/* Outcome */}
      {oc && (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Outcome</Text>
          <View style={[styles.outcomeBox, { backgroundColor: oc.bg }]}>
            <Ionicons name={oc.icon} size={18} color={oc.color} />
            <Text style={[styles.outcomeText, { color: oc.color }]}>{oc.label}</Text>
          </View>
        </View>
      )}

      {/* Amount Collected */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Amount Collected</Text>
        {editMode ? (
          <TextInput
            style={[styles.editInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            value={editFields.amount_collected != null ? String(editFields.amount_collected) : ''}
            onChangeText={(t) => onFieldUpdate('amount_collected', t ? parseInt(t, 10) || 0 : undefined)}
            keyboardType="number-pad"
            placeholder="Enter amount collected"
            placeholderTextColor={colors.text3}
          />
        ) : (
          <Text style={[styles.detailValueLarge, { color: colors.green }]}>
            {log.amount_collected != null ? `₹${log.amount_collected.toLocaleString('en-IN')}` : '—'}
          </Text>
        )}
      </View>

      {/* Amount Promised */}
      {log.amount_promised != null || editMode ? (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Amount Promised</Text>
          {editMode ? (
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              value={editFields.amount_promised != null ? String(editFields.amount_promised) : ''}
              onChangeText={(t) => onFieldUpdate('amount_promised', t ? parseInt(t, 10) || 0 : undefined)}
              keyboardType="number-pad"
              placeholder="Enter amount promised"
              placeholderTextColor={colors.text3}
            />
          ) : (
            <Text style={[styles.detailValueLarge, { color: colors.amber }]}>
              {log.amount_promised != null ? `₹${log.amount_promised.toLocaleString('en-IN')}` : '—'}
            </Text>
          )}
        </View>
      ) : null}

      {/* Promise Date */}
      {(log.promise_date || editMode) ? (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Promise Date</Text>
          {editMode ? (
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              value={editFields.promise_date ? new Date(editFields.promise_date).toLocaleDateString('en-IN') : ''}
              onChangeText={(t) => {
                // Store as ISO date string if valid, or raw input
                const d = new Date(t);
                onFieldUpdate('promise_date', isNaN(d.getTime()) ? t : d.toISOString());
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text3}
            />
          ) : (
            <Text style={[styles.detailValueLarge, { color: colors.text }]}>
              {log.promise_date ? new Date(log.promise_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
            </Text>
          )}
        </View>
      ) : null}

      {/* Status (editable) */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Status</Text>
        {editMode ? (
          <View style={styles.pickerRow}>
            {STATUS_PICKER_OPTIONS.map((opt) => {
              const active = editFields.status === opt.key;
              const cfg = STATUS_CONFIG[opt.key];
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.pickerPill,
                    { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? cfg.bg : colors.surface },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => onFieldUpdate('status', opt.key)}
                >
                  <Text style={[styles.pickerPillText, { color: active ? cfg.color : colors.text3 }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.statusDisplayBadge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusDisplayText, { color: sc.color }]}>{sc.label}</Text>
          </View>
        )}
      </View>

      {/* Outcome (editable) */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Outcome</Text>
        {editMode ? (
          <View style={styles.pickerRow}>
            {OUTCOME_PICKER_OPTIONS.map((opt) => {
              const active = editFields.outcome === opt.key;
              const cfg = OUTCOME_CONFIG[opt.key];
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.pickerPill,
                    { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? cfg.bg : colors.surface },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => onFieldUpdate('outcome', opt.key)}
                >
                  <Ionicons name={cfg.icon} size={12} color={active ? cfg.color : colors.text3} />
                  <Text style={[styles.pickerPillText, { color: active ? cfg.color : colors.text3 }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : oc ? (
          <View style={[styles.outcomeBox, { backgroundColor: oc.bg }]}>
            <Ionicons name={oc.icon} size={18} color={oc.color} />
            <Text style={[styles.outcomeText, { color: oc.color }]}>{oc.label}</Text>
          </View>
        ) : (
          <Text style={[styles.detailValueLarge, { color: colors.text3 }]}>—</Text>
        )}
      </View>

      {/* Contact Method (editable) */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Contact Method</Text>
        {editMode ? (
          <View style={styles.pickerRow}>
            {CONTACT_METHOD_PICKER_OPTIONS.map((opt) => {
              const active = editFields.contact_method === opt.key;
              const cfg = CONTACT_METHOD_CONFIG[opt.key];
              return (
                <Pressable
                  key={opt.key}
                  style={({ pressed }) => [
                    styles.pickerPill,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primaryBg : colors.surface },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => onFieldUpdate('contact_method', opt.key)}
                >
                  <Ionicons name={cfg.icon} size={12} color={active ? colors.primary : colors.text3} />
                  <Text style={[styles.pickerPillText, { color: active ? colors.primary : colors.text3 }]}>{cfg.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : log.contact_method ? (
          <DetailFieldSingle icon={CONTACT_METHOD_CONFIG[log.contact_method].icon} value={CONTACT_METHOD_CONFIG[log.contact_method].label} colors={colors} />
        ) : (
          <Text style={[styles.detailValueLarge, { color: colors.text3 }]}>—</Text>
        )}
      </View>

      {/* Duration (editable) */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Duration (minutes)</Text>
        {editMode ? (
          <TextInput
            style={[styles.editInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            value={editFields.duration_minutes != null ? String(editFields.duration_minutes) : ''}
            onChangeText={(t) => onFieldUpdate('duration_minutes', t ? parseInt(t, 10) || 0 : undefined)}
            keyboardType="number-pad"
            placeholder="Duration in minutes"
            placeholderTextColor={colors.text3}
          />
        ) : (
          <Text style={[styles.detailValueLarge, { color: colors.text }]}>
            {log.duration_minutes != null ? `${log.duration_minutes} min` : '—'}
          </Text>
        )}
      </View>

      {/* Notes (editable) */}
      <View style={styles.detailSection}>
        <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Notes</Text>
        {editMode ? (
          <TextInput
            style={[styles.editTextArea, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            value={editFields.notes || ''}
            onChangeText={(t) => onFieldUpdate('notes', t)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholder="Add notes..."
            placeholderTextColor={colors.text3}
          />
        ) : (
          <Text style={[styles.detailValue, { color: colors.text2 }]}>{log.notes || 'No notes'}</Text>
        )}
      </View>

      {/* Attachments count */}
      {log.attachments && log.attachments.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Attachments</Text>
          <View style={styles.attachmentRow}>
            <Ionicons name="attach-outline" size={16} color={colors.text3} />
            <Text style={[styles.attachmentText, { color: colors.text2 }]}>{log.attachments.length} file(s)</Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {editMode ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }, isSaving && styles.actionBtnDisabled]}
              onPress={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>Save Changes</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtnSecondary, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
              onPress={onCancelEdit}
              disabled={isSaving}
            >
              <Text style={[styles.actionBtnTextSecondary, { color: colors.text3 }]}>Cancel</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={onEdit}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Edit Log</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// REUSABLE SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════

function DetailField({ icon, label, value, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.detailField}>
      <Ionicons name={icon} size={14} color={colors.text3} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailFieldLabel, { color: colors.text3 }]}>{label}</Text>
        <Text style={[styles.detailFieldValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function DetailFieldSingle({ icon, value, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.detailFieldSingle}>
      <Ionicons name={icon} size={16} color={colors.text2} />
      <Text style={[styles.detailValueLarge, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, gap: spacing.smd,
  },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },

  // ── Metrics ──
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.lg },
  metricCard: { width: '48%', borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  metricIcon: { width: 32, height: 32, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800', marginTop: spacing.smd, letterSpacing: -0.5 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.ssm },
  metricLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metricChange: { fontSize: 11, fontWeight: '700' },

  // ── Tab Switcher ──
  tabRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.xl4, borderRadius: radii.sm, overflow: 'hidden', borderWidth: 1 },
  tab: { flex: 1, paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 12, fontWeight: '600' },

  // ── Section header ──
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Agent cards (unchanged) ──
  agentCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  agentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  agentRank: { width: 28, height: 28, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  agentRankText: { fontSize: 11, fontWeight: '800' },
  agentAvatar: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  agentAvatarText: { fontSize: 13, fontWeight: '700' },
  agentName: { fontWeight: '700', fontSize: 14 },
  agentMeta: { fontSize: 11, marginTop: 2 },
  agentCollected: { fontWeight: '700', fontSize: 14 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, marginTop: spacing.ssm },
  ratingText: { fontSize: 9, fontWeight: '700' },
  progressBar: { height: 4, backgroundColor: '#E2E5EC', borderRadius: 2, marginTop: spacing.xl, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressText: { fontSize: 10, fontWeight: '500' },
  progressPct: { fontSize: 10, fontWeight: '700' },
  expandedSection: { borderTopWidth: 1, marginTop: spacing.xl, paddingTop: spacing.xl },
  expandedRow: { flexDirection: 'row', gap: spacing.lg },
  expandedItem: { flex: 1 },
  expandedLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  expandedValue: { fontSize: 14, fontWeight: '700', marginTop: spacing.ssm },

  // ── Overdue loans (unchanged) ──
  loanCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  loanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  loanIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  loanNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  loanName: { fontWeight: '700', fontSize: 14 },
  loanRiskBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full },
  loanRiskText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  loanMetaRow: { marginTop: spacing.ssm },
  loanMeta: { fontSize: 11 },
  loanAmount: { fontWeight: '700', fontSize: 16 },
  loanDaysBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full, marginTop: spacing.ssm },
  loanDaysText: { fontSize: 9, fontWeight: '700' },

  // ── Collection Log List ──
  logCard: {
    marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1,
    borderLeftWidth: 4, padding: spacing.xl + 2, marginBottom: spacing.smd,
  },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  logTypeIcon: { width: 38, height: 38, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  logTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  logType: { fontWeight: '700', fontSize: 14 },
  logStatusBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full },
  logStatusText: { fontSize: 9, fontWeight: '700' },
  logContact: { fontSize: 11, marginTop: 2 },
  logMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  logOutcomeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full },
  logOutcomeText: { fontSize: 9, fontWeight: '700' },
  logAmount: { fontSize: 11, fontWeight: '700' },
  logTime: { fontSize: 10 },

  // ── Detail View ──
  detailCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.smd },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  backText: { fontSize: 13, fontWeight: '600' },
  detailStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, alignSelf: 'flex-start' },
  detailStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  detailType: { fontSize: 18, fontWeight: '700', marginTop: spacing.lg },
  detailLoanId: { fontSize: 11, marginTop: spacing.ssm },

  // ── Detail grid ──
  detailGrid: { marginTop: spacing.xl4, borderWidth: 1, borderRadius: radii.sm, overflow: 'hidden' },
  detailField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.smd,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 2,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  detailFieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailFieldValue: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  detailFieldSingle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.smd,
  },

  // ── Detail sections ──
  detailSection: { marginTop: spacing.xl4 },
  detailSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.smd },
  detailValueLarge: { fontSize: 15, fontWeight: '700' },
  detailValue: { fontSize: 13, lineHeight: 20 },

  // ── Outcome display ──
  outcomeBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, padding: spacing.xl, borderRadius: radii.sm },
  outcomeText: { fontSize: 14, fontWeight: '700' },
  statusDisplayBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 2, borderRadius: radii.full },
  statusDisplayText: { fontSize: 12, fontWeight: '700' },

  // ── Attachment ──
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attachmentText: { fontSize: 13 },

  // ── Edit mode ──
  editInput: {
    borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg, fontSize: 15, fontWeight: '600',
  },
  editTextArea: {
    borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg, fontSize: 13, minHeight: 80, lineHeight: 20,
  },
  pickerRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  pickerPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.full, borderWidth: 1,
  },
  pickerPillText: { fontSize: 11, fontWeight: '600' },

  // ── Action buttons ──
  actionRow: { gap: spacing.smd, marginTop: spacing.xl4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingVertical: spacing.xl + 2, borderRadius: radii.sm, minHeight: 44,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionBtnSecondary: { paddingVertical: spacing.xl + 2, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  actionBtnTextSecondary: { fontSize: 13, fontWeight: '700' },
});
