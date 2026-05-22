/**
 * RupeeFast — Admin Notification Broadcast Console
 *
 * Two-mode screen:
 *   ── Compose: Pick template → select channels → target audience → send
 *   ── History: List of past broadcasts with delivery analytics & filters
 *
 * Layout:
 *   ┌─ Top Nav ────────────────────────────────────────────┐
 *   ├─ Segmented Control: [Compose | History]              │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 *   │  Compose: Template picker | Channel toggles         │
 *   │  Audience filters | Message preview | Send button   │
 *   │  History: Search bar | Status/channel filters       │
 *   │  Broadcast list with delivery stats | Tap for detail│
 *   └──────────────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { ENDPOINTS } from '../../src/api/endpoints';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Types ──

interface Template {
  id: number;
  name: string;
  label: string;
  channel: 'sms' | 'whatsapp' | 'push';
  subject: string | null;
  body: string;
  variables: string[];
  is_active: boolean;
}

interface Broadcast {
  id: number;
  template_id: number | null;
  title: string;
  message: string;
  channels: string[];
  target_filters: { roles: string[]; kyc_status?: string; min_trust_score?: number };
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  opened_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  template_name: string | null;
  template_label: string | null;
  created_by_name: string | null;
}

interface Analytics {
  stats: {
    total_broadcasts: number;
    total_recipients: number;
    total_sent: number;
    total_delivered: number;
    total_failed: number;
    total_opened: number;
  };
  channelStats: { channel: string; broadcast_count: number; recipients: number }[];
  recent: Broadcast[];
}

// ── Channel icons & colors ──

const CHANNEL_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  sms:     { icon: 'chatbubbles', color: '#2562A8', label: 'SMS' },
  whatsapp: { icon: 'logo-whatsapp', color: '#0B6B4A', label: 'WhatsApp' },
  push:    { icon: 'notifications', color: '#5A3E9B', label: 'Push' },
};

const STATUS_COLORS: Record<string, string> = {
  sent: '#0B6B4A',
  partial: '#9A6200',
  sending: '#2562A8',
  draft: '#6B7280',
  scheduled: '#5A3E9B',
  cancelled: '#A02020',
};

// ── Fallback Data ──

const FALLBACK_TEMPLATES: Template[] = [
  { id: 1, name: 'emi_reminder', label: 'EMI Reminder', channel: 'sms', subject: null, body: 'Hi {{name}}, your EMI of ₹{{amount}} is due on {{due_date}}. Pay now to avoid late fees. - RupeeFast', variables: ['name', 'amount', 'due_date'], is_active: true },
  { id: 2, name: 'payment_success', label: 'Payment Confirmation', channel: 'push', subject: 'Payment Successful', body: 'Your payment of ₹{{amount}} has been received. Thank you!', variables: ['amount'], is_active: true },
  { id: 3, name: 'kyc_approved', label: 'KYC Approved', channel: 'whatsapp', subject: 'KYC Verified', body: '✅ KYC Approved! Dear {{name}}, Your KYC has been approved. You can now apply for loans up to ₹{{loan_limit}}.', variables: ['name', 'loan_limit'], is_active: true },
  { id: 4, name: 'kyc_rejected', label: 'KYC Rejected', channel: 'sms', subject: null, body: 'Hi {{name}}, your KYC needs re-submission. Reason: {{reason}}.', variables: ['name', 'reason'], is_active: true },
  { id: 5, name: 'loan_approved', label: 'Loan Approved', channel: 'push', subject: 'Loan Approved 🎉', body: 'Congratulations {{name}}! Your loan of ₹{{amount}} has been approved.', variables: ['name', 'amount'], is_active: true },
  { id: 6, name: 'overdue_reminder', label: 'Overdue Warning', channel: 'sms', subject: null, body: 'URGENT: {{name}}, your payment of ₹{{amount}} is {{days_overdue}} days overdue.', variables: ['name', 'amount', 'days_overdue'], is_active: true },
  { id: 7, name: 'promo_offer', label: 'Special Offer', channel: 'sms', subject: null, body: 'Hi {{name}}, get a loan of up to ₹{{limit}} at just {{rate}}% interest!', variables: ['name', 'limit', 'rate'], is_active: true },
  { id: 8, name: 'referral_reward', label: 'Referral Reward', channel: 'push', subject: 'You Earned ₹{{amount}}!', body: 'Your referral {{friend_name}} joined RupeeFast. You earned ₹{{amount}}!', variables: ['amount', 'friend_name'], is_active: true },
  { id: 9, name: 'investor_update', label: 'Investor Update', channel: 'whatsapp', subject: 'Portfolio Update', body: 'Dear {{name}}, your investments earned ₹{{earnings}} this month.', variables: ['name', 'earnings'], is_active: true },
  { id: 10, name: 'agent_task', label: 'New Agent Task', channel: 'push', subject: 'New Task Assigned', body: 'You have a new {{task_type}} task for {{customer_name}}.', variables: ['task_type', 'customer_name'], is_active: true },
];

const FALLBACK_BROADCASTS: Broadcast[] = [
  { id: 1, template_id: 2, title: 'Payment Confirmation', message: 'Your payment of ₹120 has been received.', channels: ['push'], target_filters: { roles: ['borrower'] }, total_recipients: 3, sent_count: 3, delivered_count: 3, failed_count: 0, opened_count: 2, status: 'sent', scheduled_for: null, sent_at: '2025-02-01T08:00:00Z', completed_at: '2025-02-01T08:01:00Z', created_at: '2025-02-01T07:55:00Z', template_name: 'payment_success', template_label: 'Payment Confirmation', created_by_name: 'Admin User' },
  { id: 2, template_id: 1, title: 'EMI Reminder Batch', message: 'Hi, your EMI of ₹120 is due on 2025-02-16.', channels: ['sms', 'push'], target_filters: { roles: ['borrower'], kyc_status: 'verified' }, total_recipients: 2, sent_count: 2, delivered_count: 2, failed_count: 0, opened_count: 1, status: 'sent', scheduled_for: null, sent_at: '2025-02-15T09:00:00Z', completed_at: '2025-02-15T09:02:00Z', created_at: '2025-02-14T10:00:00Z', template_name: 'emi_reminder', template_label: 'EMI Reminder', created_by_name: 'Admin User' },
  { id: 3, template_id: 7, title: 'Festival Offer Blast', message: 'Hi, get a loan of up to ₹50,000!', channels: ['sms', 'whatsapp'], target_filters: { roles: ['borrower', 'investor'] }, total_recipients: 5, sent_count: 4, delivered_count: 3, failed_count: 1, opened_count: 0, status: 'partial', scheduled_for: null, sent_at: '2025-03-01T10:00:00Z', completed_at: '2025-03-01T10:05:00Z', created_at: '2025-02-28T12:00:00Z', template_name: 'promo_offer', template_label: 'Special Offer', created_by_name: 'Admin User' },
  { id: 4, template_id: 10, title: 'Agent Assignment', message: 'You have a new recovery task.', channels: ['push'], target_filters: { roles: ['agent'] }, total_recipients: 2, sent_count: 2, delivered_count: 2, failed_count: 0, opened_count: 2, status: 'sent', scheduled_for: null, sent_at: '2025-03-02T08:00:00Z', completed_at: '2025-03-02T08:00:30Z', created_at: '2025-03-02T07:55:00Z', template_name: 'agent_task', template_label: 'New Agent Task', created_by_name: 'Admin User' },
  { id: 5, template_id: 9, title: 'Monthly Investor Digest', message: 'Your investments earned ₹1,455 this month.', channels: ['whatsapp', 'push'], target_filters: { roles: ['investor'] }, total_recipients: 2, sent_count: 2, delivered_count: 1, failed_count: 1, opened_count: 0, status: 'partial', scheduled_for: null, sent_at: '2025-03-01T09:00:00Z', completed_at: '2025-03-01T09:01:00Z', created_at: '2025-02-28T16:00:00Z', template_name: 'investor_update', template_label: 'Investor Update', created_by_name: 'Admin User' },
  { id: 6, template_id: 1, title: 'Scheduled EMI Reminder', message: 'Upcoming EMI reminder for all borrowers.', channels: ['sms', 'push'], target_filters: { roles: ['borrower'] }, total_recipients: 0, sent_count: 0, delivered_count: 0, failed_count: 0, opened_count: 0, status: 'scheduled', scheduled_for: '2025-04-01T09:00:00Z', sent_at: null, completed_at: null, created_at: '2025-03-28T10:00:00Z', template_name: 'emi_reminder', template_label: 'EMI Reminder', created_by_name: 'Admin User' },
];

const FALLBACK_ANALYTICS: Analytics = {
  stats: { total_broadcasts: 6, total_recipients: 16, total_sent: 15, total_delivered: 13, total_failed: 3, total_opened: 7 },
  channelStats: [
    { channel: 'push', broadcast_count: 5, recipients: 12 },
    { channel: 'sms', broadcast_count: 3, recipients: 8 },
    { channel: 'whatsapp', broadcast_count: 2, recipients: 4 },
  ],
  recent: FALLBACK_BROADCASTS.slice(0, 5),
};

// ── Template Preview ──

function renderPreview(template: Template | null, vars: Record<string, string>): string {
  if (!template) return '';
  let body = template.body;
  for (const [key, val] of Object.entries(vars)) {
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `{{${key}}}`);
  }
  return body;
}

// ══════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════

export default function AdminBroadcastScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  // ── Mode ──
  const [mode, setMode] = useState<'compose' | 'history'>('compose');

  // ── Compose state ──
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['push']);
  const [targetRoles, setTargetRoles] = useState<string[]>(['borrower']);
  const [kycFilter, setKycFilter] = useState<string>('');
  const [minScore, setMinScore] = useState('');
  const [sending, setSending] = useState(false);

  // ── History state ──
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  // ── Data fetching ──
  const templatesFetcher = useCallback(async () => {
    const result = await apiFetch<Template[]>(ENDPOINTS.NOTIFICATION_TEMPLATES + '?active=true');
    if (result.success && Array.isArray(result.data)) return result.data;
    return null;
  }, []);

  const broadcastsFetcher = useCallback(async () => {
    const result = await apiFetch<{ broadcasts: Broadcast[]; total: number }>(ENDPOINTS.NOTIFICATION_BROADCASTS);
    if (result.success && result.data) return result.data.broadcasts;
    return null;
  }, []);

  const analyticsFetcher = useCallback(async () => {
    const result = await apiFetch<Analytics>(ENDPOINTS.NOTIFICATION_ANALYTICS);
    if (result.success && result.data) return result.data;
    return null;
  }, []);

  const { data: templates, loading: templatesLoading } = useTimedAsyncData(templatesFetcher, FALLBACK_TEMPLATES, 5000);
  const { data: broadcasts, loading: broadcastsLoading } = useTimedAsyncData(broadcastsFetcher, FALLBACK_BROADCASTS, 5000);
  const { data: analytics } = useTimedAsyncData(analyticsFetcher, FALLBACK_ANALYTICS, 5000);

  // ── Filter broadcasts ──
  const filteredBroadcasts = (broadcasts || []).filter((b) => {
    if (historySearch && !b.title.toLowerCase().includes(historySearch.toLowerCase())) return false;
    if (statusFilter && b.status !== statusFilter) return false;
    if (channelFilter && !b.channels.includes(channelFilter)) return false;
    return true;
  });

  // ── Template variable editor ──
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setCustomTitle(template.subject || '');
    setCustomMessage(template.body);
    // Initialize variable values
    const initial: Record<string, string> = {};
    for (const v of template.variables) {
      initial[v] = '';
    }
    setVarValues(initial);
  }, []);

  const toggleChannel = useCallback((ch: string) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }, []);

  const toggleRole = useCallback((role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }, []);

  // ── Send broadcast ──
  const handleSend = useCallback(async () => {
    if (selectedChannels.length === 0) {
      Alert.alert('Error', 'Select at least one channel (SMS, WhatsApp, or Push).');
      return;
    }
    if (!customMessage.trim() && !selectedTemplate) {
      Alert.alert('Error', 'Enter a message or select a template.');
      return;
    }

    setSending(true);
    try {
      const result = await apiFetch(ENDPOINTS.NOTIFICATION_BROADCAST, {
        method: 'POST',
        body: {
          template_id: selectedTemplate?.id || null,
          title: customTitle || undefined,
          message: customMessage || undefined,
          channels: selectedChannels,
          target_roles: targetRoles,
          kyc_status: kycFilter || undefined,
          min_trust_score: minScore ? parseInt(minScore, 10) : undefined,
        },
      });

      if (result.success) {
        Alert.alert('Broadcast Sent', `Broadcast #${(result.data as any).broadcast_id} dispatched. Check history for delivery status.`);
        // Reset form
        setSelectedTemplate(null);
        setCustomTitle('');
        setCustomMessage('');
        setSelectedChannels(['push']);
        setVarValues({});
      } else {
        Alert.alert('Error', result.error || 'Failed to send broadcast');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  }, [selectedChannels, customMessage, selectedTemplate, customTitle, targetRoles, kycFilter, minScore]);

  // ── Cancel broadcast ──
  const handleCancelBroadcast = useCallback(async (id: number) => {
    Alert.alert('Cancel Broadcast', 'Are you sure you want to cancel this broadcast?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        const result = await apiFetch(ENDPOINTS.NOTIFICATION_BROADCAST_CANCEL(id), { method: 'POST' });
        if (result.success) {
          Alert.alert('Cancelled', 'Broadcast has been cancelled.');
          setSelectedBroadcast(null);
        }
      }},
    ]);
  }, []);

  // ── Helper for status display ──
  const statusDisplay = (status: string) => {
    const map: Record<string, string> = {
      sent: 'Sent', partial: 'Partial', sending: 'Sending',
      draft: 'Draft', scheduled: 'Scheduled', cancelled: 'Cancelled',
    };
    return map[status] || status;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Ionicons name="megaphone" size={20} color={colors.primary} />
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Broadcast</Text>
      </View>

      {/* ── Segmented Control ── */}
      <View style={[styles.segmentRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable
          style={[styles.segmentBtn, mode === 'compose' && { backgroundColor: colors.primary }]}
          onPress={() => { setMode('compose'); setSelectedBroadcast(null); }}
        >
          <Ionicons name="create-outline" size={16} color={mode === 'compose' ? '#fff' : colors.text3} />
          <Text style={[styles.segmentLabel, { color: mode === 'compose' ? '#fff' : colors.text3 }]}>Compose</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, mode === 'history' && { backgroundColor: colors.primary }]}
          onPress={() => { setMode('history'); setSelectedBroadcast(null); }}
        >
          <Ionicons name="time-outline" size={16} color={mode === 'history' ? '#fff' : colors.text3} />
          <Text style={[styles.segmentLabel, { color: mode === 'history' ? '#fff' : colors.text3 }]}>History</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ═══════════ COMPOSE MODE ═══════════ */}
        {mode === 'compose' && (
          <>
            {/* ── Analytics Summary ── */}
            {analytics && (
              <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.summaryTitle, { color: colors.text3 }]}>Campaign Overview</Text>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.primary }]}>{analytics.stats.total_broadcasts}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Broadcasts</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.green }]}>{analytics.stats.total_sent}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Sent</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: colors.text }]}>{analytics.stats.total_delivered}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Delivered</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: analytics.stats.total_failed > 0 ? colors.red : colors.green }]}>{analytics.stats.total_failed}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Failed</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Template Selector ── */}
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>1. Choose Template</Text>
            {templatesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.xl }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
                <View style={styles.templateRow}>
                  {templates.map((t) => (
                    <Pressable
                      key={t.id}
                      style={({ pressed }) => [
                        styles.templateChip,
                        { backgroundColor: selectedTemplate?.id === t.id ? colors.primary : colors.surface, borderColor: colors.border },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => handleSelectTemplate(t)}
                    >
                      <Ionicons
                        name={CHANNEL_CONFIG[t.channel]?.icon || 'chatbubble'}
                        size={16}
                        color={selectedTemplate?.id === t.id ? '#fff' : CHANNEL_CONFIG[t.channel]?.color || colors.text3}
                      />
                      <Text
                        style={[styles.templateChipLabel, { color: selectedTemplate?.id === t.id ? '#fff' : colors.text }]}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* ── Message Editor ── */}
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>2. Message</Text>
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderBottomColor: colors.borderLight }]}
                placeholder="Notification title (for push)"
                placeholderTextColor={colors.text3}
                value={customTitle}
                onChangeText={setCustomTitle}
              />
              <TextInput
                style={[styles.bodyInput, { color: colors.text }]}
                placeholder="Type your message or use a template above..."
                placeholderTextColor={colors.text3}
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* ── Variables editor ── */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text2 }]}>3. Fill Variables (Preview)</Text>
                <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {selectedTemplate.variables.map((v) => (
                    <View key={v} style={[styles.varRow, { borderBottomColor: colors.borderLight }]}>
                      <Text style={[styles.varLabel, { color: colors.text2 }]}>{`{{${v}}}`}</Text>
                      <TextInput
                        style={[styles.varInput, { color: colors.text, backgroundColor: colors.bg }]}
                        placeholder={`Enter ${v}...`}
                        placeholderTextColor={colors.text3}
                        value={varValues[v] || ''}
                        onChangeText={(text) => setVarValues((prev) => ({ ...prev, [v]: text }))}
                      />
                    </View>
                  ))}
                  <View style={[styles.previewBox, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.previewLabel, { color: colors.text3 }]}>Preview:</Text>
                    <Text style={[styles.previewText, { color: colors.text }]}>
                      {renderPreview(selectedTemplate, varValues)}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* ── Channel Selector ── */}
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>4. Channels</Text>
            <View style={styles.chipRow}>
              {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
                <Pressable
                  key={key}
                  style={({ pressed }) => [
                    styles.channelBtn,
                    { backgroundColor: selectedChannels.includes(key) ? cfg.color : colors.surface, borderColor: colors.border },
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => toggleChannel(key)}
                >
                  <Ionicons name={cfg.icon} size={16} color={selectedChannels.includes(key) ? '#fff' : cfg.color} />
                  <Text style={[styles.channelLabel, { color: selectedChannels.includes(key) ? '#fff' : colors.text }]}>{cfg.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Target Audience ── */}
            <Text style={[styles.sectionTitle, { color: colors.text2 }]}>5. Target Audience</Text>
            <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.fieldLabel, { color: colors.text3 }]}>User Roles</Text>
              <View style={styles.chipRow}>
                {['borrower', 'investor', 'agent'].map((role) => (
                  <Pressable
                    key={role}
                    style={({ pressed }) => [
                      styles.roleChip,
                      { backgroundColor: targetRoles.includes(role) ? colors.primary : colors.bg, borderColor: colors.border },
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => toggleRole(role)}
                  >
                    <Ionicons
                      name={role === 'borrower' ? 'person' : role === 'investor' ? 'wallet' : 'briefcase'}
                      size={14}
                      color={targetRoles.includes(role) ? '#fff' : colors.text2}
                    />
                    <Text style={[styles.channelLabel, { color: targetRoles.includes(role) ? '#fff' : colors.text, textTransform: 'capitalize' }]}>{role}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.filterRow, { marginTop: spacing.lg }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text3 }]}>KYC Status</Text>
                  <View style={styles.chipRow}>
                    {['', 'verified', 'pending'].map((s) => (
                      <Pressable
                        key={s || 'all'}
                        style={({ pressed }) => [
                          styles.smallChip,
                          { backgroundColor: kycFilter === s ? colors.primary : colors.bg, borderColor: colors.border },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => setKycFilter(s)}
                      >
                        <Text style={[styles.smallChipText, { color: kycFilter === s ? '#fff' : colors.text }]}>
                          {s || 'All'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={{ width: spacing.xxl }} />
                <View style={{ width: 100 }}>
                  <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Min Score</Text>
                  <TextInput
                    style={[styles.scoreInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
                    placeholder="0"
                    placeholderTextColor={colors.text3}
                    value={minScore}
                    onChangeText={setMinScore}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>

            {/* ── Send Button ── */}
            <Pressable
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: sending ? colors.text3 : colors.primary },
                pressed && !sending && { opacity: 0.9 },
              ]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendBtnText}>
                    Send Broadcast {selectedChannels.length > 0 ? `(${selectedChannels.length} channel${selectedChannels.length > 1 ? 's' : ''})` : ''}
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}

        {/* ═══════════ HISTORY MODE ═══════════ */}
        {mode === 'history' && (
          <>
            {/* ── Selected Broadcast Detail ── */}
            {selectedBroadcast ? (
              <View>
                <Pressable
                  style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedBroadcast(null)}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.primary} />
                  <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to History</Text>
                </Pressable>

                <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.detailHeader}>
                    <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedBroadcast.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[selectedBroadcast.status]}15` }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[selectedBroadcast.status] }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLORS[selectedBroadcast.status] }]}>
                        {statusDisplay(selectedBroadcast.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.detailMessage, { color: colors.text2 }]}>{selectedBroadcast.message}</Text>

                  {/* Channels used */}
                  <View style={styles.detailSection}>
                    <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Channels</Text>
                    <View style={styles.chipRow}>
                      {selectedBroadcast.channels.map((ch) => (
                        <View key={ch} style={[styles.channelBadge, { backgroundColor: `${CHANNEL_CONFIG[ch]?.color || colors.text3}15` }]}>
                          <Ionicons name={CHANNEL_CONFIG[ch]?.icon || 'chatbubble'} size={14} color={CHANNEL_CONFIG[ch]?.color || colors.text3} />
                          <Text style={[styles.channelBadgeText, { color: CHANNEL_CONFIG[ch]?.color || colors.text3 }]}>{CHANNEL_CONFIG[ch]?.label || ch}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Delivery stats */}
                  <View style={[styles.statsGrid, { borderTopColor: colors.borderLight }]}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.text }]}>{selectedBroadcast.total_recipients}</Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Targeted</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.green }]}>{selectedBroadcast.sent_count}</Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Sent</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.primary }]}>{selectedBroadcast.delivered_count}</Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Delivered</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: selectedBroadcast.failed_count > 0 ? colors.red : colors.green }]}>{selectedBroadcast.failed_count}</Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Failed</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.amber }]}>{selectedBroadcast.opened_count}</Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Opened</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {selectedBroadcast.total_recipients > 0
                          ? `${Math.round((selectedBroadcast.delivered_count / selectedBroadcast.total_recipients) * 100)}%`
                          : '-'}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.text3 }]}>Rate</Text>
                    </View>
                  </View>

                  {/* Meta info */}
                  <View style={[styles.metaSection, { borderTopColor: colors.borderLight }]}>
                    {selectedBroadcast.template_label && (
                      <Text style={[styles.metaText, { color: colors.text3 }]}>
                        Template: {selectedBroadcast.template_label}
                      </Text>
                    )}
                    <Text style={[styles.metaText, { color: colors.text3 }]}>
                      Created by: {selectedBroadcast.created_by_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.metaText, { color: colors.text3 }]}>
                      Sent: {selectedBroadcast.sent_at ? new Date(selectedBroadcast.sent_at).toLocaleString('en-IN') : 'Not sent'}
                    </Text>
                    <Text style={[styles.metaText, { color: colors.text3 }]}>
                      Completed: {selectedBroadcast.completed_at ? new Date(selectedBroadcast.completed_at).toLocaleString('en-IN') : '-'}
                    </Text>
                  </View>

                  {/* Cancel button (only for cancellable statuses) */}
                  {['draft', 'scheduled', 'sending'].includes(selectedBroadcast.status) && (
                    <Pressable
                      style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => handleCancelBroadcast(selectedBroadcast.id)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={colors.red} />
                      <Text style={[styles.cancelBtnText, { color: colors.red }]}>Cancel Broadcast</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              <>
                {/* ── Search & Filters ── */}
                <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={16} color={colors.text3} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search broadcasts..."
                    placeholderTextColor={colors.text3}
                    value={historySearch}
                    onChangeText={setHistorySearch}
                  />
                </View>

                <View style={styles.filterRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChipRow}>
                      {['', 'sent', 'partial', 'scheduled', 'draft', 'cancelled'].map((s) => (
                        <Pressable
                          key={s || 'all'}
                          style={({ pressed }) => [
                            styles.filterChip,
                            { backgroundColor: statusFilter === s ? colors.primary : colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => setStatusFilter(s)}
                        >
                          <Text style={[styles.filterChipText, { color: statusFilter === s ? '#fff' : colors.text }]}>
                            {s || 'All Status'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.filterRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChipRow}>
                      {['', 'push', 'sms', 'whatsapp'].map((ch) => (
                        <Pressable
                          key={ch || 'all'}
                          style={({ pressed }) => [
                            styles.filterChip,
                            { backgroundColor: channelFilter === ch ? (CHANNEL_CONFIG[ch]?.color || colors.primary) : colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => setChannelFilter(ch)}
                        >
                          {ch ? (
                            <Ionicons name={CHANNEL_CONFIG[ch]?.icon || 'chatbubble'} size={14} color={channelFilter === ch ? '#fff' : CHANNEL_CONFIG[ch]?.color} />
                          ) : null}
                          <Text style={[styles.filterChipText, { color: channelFilter === ch ? '#fff' : colors.text, marginLeft: ch ? spacing.ssm : 0 }]}>
                            {ch || 'All Channels'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* ── Broadcast List ── */}
                {broadcastsLoading ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
                ) : filteredBroadcasts.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="megaphone-outline" size={40} color={colors.text3} />
                    <Text style={[styles.emptyText, { color: colors.text3 }]}>No broadcasts found</Text>
                  </View>
                ) : (
                  <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {filteredBroadcasts.map((b, i) => (
                      <Pressable
                        key={b.id}
                        style={({ pressed }) => [
                          styles.broadcastItem,
                          { borderBottomColor: colors.borderLight },
                          i === filteredBroadcasts.length - 1 && { borderBottomWidth: 0 },
                          pressed && { backgroundColor: colors.surfaceHover },
                        ]}
                        onPress={() => setSelectedBroadcast(b)}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.broadcastHead}>
                            <Text style={[styles.broadcastTitle, { color: colors.text }]} numberOfLines={1}>{b.title}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[b.status]}15` }]}>
                              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[b.status] }]} />
                              <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] }]}>
                                {statusDisplay(b.status)}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.broadcastMsg, { color: colors.text2 }]} numberOfLines={2}>{b.message}</Text>
                          <View style={styles.broadcastMeta}>
                            <View style={styles.chipRow}>
                              {b.channels.map((ch) => (
                                <Ionicons
                                  key={ch}
                                  name={CHANNEL_CONFIG[ch]?.icon || 'chatbubble'}
                                  size={12}
                                  color={CHANNEL_CONFIG[ch]?.color || colors.text3}
                                  style={{ marginRight: spacing.xs }}
                                />
                              ))}
                            </View>
                            <Text style={[styles.broadcastDate, { color: colors.text3 }]}>
                              {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Text>
                            <View style={[styles.miniStat, { backgroundColor: colors.bg }]}>
                              <Text style={[styles.miniStatText, { color: b.failed_count > 0 ? colors.red : colors.green }]}>
                                {b.sent_count}/{b.total_recipients || '?'} sent
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.text3} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, gap: spacing.smd, borderBottomWidth: 1,
  },
  topNavTitle: { fontSize: 17, fontWeight: '700' },
  segmentRow: {
    flexDirection: 'row', paddingHorizontal: spacing.xxl, paddingVertical: spacing.smd,
    gap: spacing.md, borderBottomWidth: 1,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.smd, borderRadius: radii.md,
  },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl5 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl3, paddingBottom: spacing.md },

  // ── Summary ──
  summaryCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  summaryTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.lg },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '500', marginTop: spacing.ssm },

  // ── Template selector ──
  templateScroll: { marginLeft: spacing.lg, marginBottom: spacing.lg },
  templateRow: { flexDirection: 'row', gap: spacing.md },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md + 2,
    borderRadius: radii.full, borderWidth: 1, maxWidth: 180,
  },
  templateChipLabel: { fontSize: 12, fontWeight: '600' },

  // ── Inputs ──
  inputCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden', padding: spacing.xl + 2 },
  textInput: { fontSize: 14, fontWeight: '600', paddingVertical: spacing.md, borderBottomWidth: 1 },
  bodyInput: { fontSize: 13, paddingVertical: spacing.md, minHeight: 80 },
  fieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },

  // ── Variable editor ──
  varRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  varLabel: { fontSize: 12, fontWeight: '700', width: 100 },
  varInput: { flex: 1, fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.xs },
  previewBox: { marginTop: spacing.lg, padding: spacing.xl + 2, borderRadius: radii.xs },
  previewLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  previewText: { fontSize: 13, lineHeight: 18 },

  // ── Channels ──
  chipRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  channelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md,
    borderRadius: radii.full, borderWidth: 1,
  },
  channelLabel: { fontSize: 13, fontWeight: '600' },
  channelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.ssm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
  },
  channelBadgeText: { fontSize: 11, fontWeight: '600' },

  // ── Target roles ──
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterRow: { flexDirection: 'row', marginTop: spacing.smd, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  smallChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  smallChipText: { fontSize: 11, fontWeight: '600' },
  scoreInput: { fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radii.xs, borderWidth: 1, textAlign: 'center' },

  // ── Send button ──
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.xl3,
    paddingVertical: spacing.xl + 2, borderRadius: radii.sm,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── History filters ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md,
    borderRadius: radii.sm, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13 },
  filterChipRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '600' },

  // ── Broadcast Items ──
  listCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  broadcastItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.xl + 2, borderBottomWidth: 1,
  },
  broadcastHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  broadcastTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  broadcastMsg: { fontSize: 12, lineHeight: 16, marginBottom: spacing.md },
  broadcastMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  broadcastDate: { fontSize: 10, fontWeight: '500' },
  miniStat: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  miniStatText: { fontSize: 10, fontWeight: '700' },

  // ── Status badges ──
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radii.full },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl5, padding: spacing.xl7, borderRadius: radii.sm, borderWidth: 1 },
  emptyText: { fontSize: 14, fontWeight: '600', marginTop: spacing.lg },

  // ── Detail view ──
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  backLinkText: { fontSize: 13, fontWeight: '600' },
  detailCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.xl + 2, paddingBottom: 0 },
  detailTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  detailMessage: { fontSize: 13, lineHeight: 18, padding: spacing.xl + 2, paddingBottom: 0, marginTop: spacing.md },
  detailSection: { padding: spacing.xl + 2, paddingBottom: 0 },
  detailSectionLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, marginTop: spacing.xl + 2, paddingTop: spacing.xl + 2, paddingHorizontal: spacing.xl + 2, gap: spacing.smd },
  statItem: { width: '30%', alignItems: 'center', marginBottom: spacing.lg },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '500', marginTop: spacing.xs },
  metaSection: { borderTopWidth: 1, padding: spacing.xl + 2, gap: spacing.sm },
  metaText: { fontSize: 11, lineHeight: 16 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl + 2, borderTopWidth: 1, borderTopColor: '#E2E5EC' },
  cancelBtnText: { fontSize: 13, fontWeight: '700' },
});
