/**
 * RupeeFast — Admin Fraud Monitoring (Migration 008 Enhanced)
 *
 * Uses the full FraudEvent type with fields:
 *   detected_by, risk_score_delta, device_id, ip_address,
 *   action_taken, resolution, event_type, metadata
 *
 * Layout:
 *   ┌─ Top Nav (title, critical count) ───────────────────┐
 *   ├─ Filter Pills (severity / status / event_type) ─────┤
 *   ├─ Alert Banner (critical alert summary) ─────────────┤
 *   ├─ Fraud Metrics (Flagged | Open | Resolved) ─────────┤
 *   ├─ List / Detail View ────────────────────────────────┤
 *   └─ Bottom tab nav ────────────────────────────────────┘
 */

import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';
import { updateFraudEventStatus } from '../../src/services/fraud';
import type {
  FraudEvent,
  FraudSeverity,
  FraudStatus,
  FraudEventType,
  FraudDetectedBy,
} from '../../src/types';

// ── Constants ──

/** Filter options for the pill row */
const SEVERITY_OPTIONS: FraudSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const STATUS_OPTIONS: FraudStatus[] = ['open', 'investigating', 'confirmed', 'dismissed', 'resolved'];

/** Map event_type → icon + label for list display */
const EVENT_TYPE_CONFIG: Record<FraudEventType, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  multiple_login:       { icon: 'log-in-outline',      label: 'Multiple Login' },
  suspicious_device:   { icon: 'phone-portrait-outline', label: 'Suspicious Device' },
  kyc_tampering:       { icon: 'document-text-outline', label: 'KYC Tampering' },
  payment_anomaly:     { icon: 'card-outline',         label: 'Payment Anomaly' },
  identity_theft:      { icon: 'person-remove-outline', label: 'Identity Theft' },
  account_takeover:    { icon: 'shield-checkmark-outline', label: 'Account Takeover' },
  synthetic_identity:  { icon: 'copy-outline',         label: 'Synthetic Identity' },
  document_forgery:    { icon: 'documents-outline',    label: 'Document Forgery' },
  circle_fraud:        { icon: 'people-outline',       label: 'Circle Fraud' },
  application_abuse:   { icon: 'apps-outline',         label: 'Application Abuse' },
  collusion:           { icon: 'link-outline',         label: 'Collusion' },
  chargeback:          { icon: 'refresh-outline',      label: 'Chargeback' },
  unusual_location:    { icon: 'location-outline',     label: 'Unusual Location' },
  velocity_breach:     { icon: 'speedometer-outline',  label: 'Velocity Breach' },
  manual_review:       { icon: 'search-outline',       label: 'Manual Review' },
};

/** Config for detected_by badges */
const DETECTED_BY_CONFIG: Record<FraudDetectedBy, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  system:       { label: 'System',      color: '#5A3E9B', bg: '#F0EBFF', icon: 'hardware-chip-outline' },
  admin_rule:   { label: 'Admin Rule',  color: '#1B3A6B', bg: '#EBF2FB', icon: 'code-slash-outline' },
  manual:       { label: 'Manual',      color: '#9A6200', bg: '#FEF3DC', icon: 'person-outline' },
  agent_report: { label: 'Agent Report',color: '#0B6B4A', bg: '#E3F5EE', icon: 'walk-outline' },
  external_api: { label: 'External API',color: '#D44040', bg: '#FEF0F0', icon: 'cloud-outline' },
};

const SEVERITY_CONFIG: Record<FraudSeverity, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  critical: { color: '#A02020', bg: '#FDEAEA', icon: 'alert-circle' },
  high:     { color: '#D44040', bg: '#FEF0F0', icon: 'warning' },
  medium:   { color: '#9A6200', bg: '#FEF3DC', icon: 'alert' },
  low:      { color: '#0B6B4A', bg: '#E3F5EE', icon: 'information-circle' },
  info:     { color: '#5A3E9B', bg: '#F0EBFF', icon: 'information-circle-outline' },
};

const STATUS_CONFIG: Record<FraudStatus, { label: string; color: string }> = {
  open:           { label: 'Open',          color: '#D44040' },
  investigating:  { label: 'Investigating', color: '#9A6200' },
  confirmed:      { label: 'Confirmed',     color: '#A02020' },
  dismissed:      { label: 'Dismissed',     color: '#0B6B4A' },
  resolved:       { label: 'Resolved',      color: '#0B6B4A' },
};

/** Format risk_score_delta with sign and color class */
function formatRiskDelta(delta: number): { text: string; color: string } {
  if (delta > 0) return { text: `+${delta}`, color: '#D44040' };
  if (delta < 0) return { text: `${delta}`, color: '#0B6B4A' };
  return { text: '0', color: '#9CA3AF' };
}

// ── Fallback mock data using FraudEvent type ──

const FALLBACK_EVENTS: FraudEvent[] = [
  {
    id: 1,
    event_type: 'suspicious_device',
    severity: 'critical',
    status: 'open',
    title: 'Device Farming Detected',
    description: 'Same device fingerprint detected across 3 different borrower accounts indicating device farming operation',
    detected_by: 'system',
    risk_score_delta: 45,
    device_id: 'A3X9K2F7D1',
    ip_address: '103.95.82.14',
    user_id: 101,
    metadata: { duplicate_devices: ['A3X9K2F7D1', 'A3X9K2F7D2', 'A3X9K2F7D3'], accounts: ['Ravi S.', 'Sneha P.', 'Arjun K.'] },
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    event_type: 'synthetic_identity',
    severity: 'high',
    status: 'investigating',
    title: 'PAN Verification Failed',
    description: 'PAN verification failed: name mismatch with government database — possible synthetic identity',
    detected_by: 'external_api',
    risk_score_delta: 35,
    device_id: 'B7M1P4L9X2',
    ip_address: '182.76.41.9',
    user_id: 102,
    action_taken: 'Manual KYC review initiated, documents flagged for verification',
    metadata: { pan_status: 'not_issued', aadhaar_pan_linkage: 'failed', email_domain: 'flagged' },
    created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    event_type: 'unusual_location',
    severity: 'high',
    status: 'open',
    title: 'GPS Spoofing Suspected',
    description: 'Agent check-in GPS coordinates flagged as virtual location — mock location API detected',
    detected_by: 'system',
    risk_score_delta: 28,
    device_id: 'C5N8R2T3K7',
    ip_address: '45.79.163.12',
    metadata: { gps_accuracy: '>100m', mock_location_api: true, coordinate_jump: '15km in 2s' },
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 4,
    event_type: 'velocity_breach',
    severity: 'medium',
    status: 'open',
    title: 'Rate Limit Abuse Detected',
    description: '40+ loan applications submitted within 5 minutes from same device — velocity breach',
    detected_by: 'system',
    risk_score_delta: 15,
    device_id: 'D2P9H5M7V1',
    ip_address: '203.122.58.33',
    metadata: { rate_exceeded: '8x', same_device_count: 4, rapid_submissions: true },
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 5,
    event_type: 'identity_theft',
    severity: 'critical',
    status: 'investigating',
    title: 'Phishing Campaign Underway',
    description: 'Fake customer support page detected mimicking RupeeFast login — reported by 12 users',
    detected_by: 'admin_rule',
    risk_score_delta: 50,
    ip_address: 'Various',
    action_taken: 'Domain takedown initiated, affected users notified to change passwords',
    metadata: {
      suspicious_domains: ['rupeefast-support.xyz', 'rupeefast-verify.com'],
      ssl_flagged: true,
      reported_by_count: 12,
    },
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 6,
    event_type: 'payment_anomaly',
    severity: 'medium',
    status: 'resolved',
    title: 'Payment Card Testing',
    description: 'Multiple failed payment attempts with different cards in 2 minutes — card testing pattern',
    detected_by: 'system',
    risk_score_delta: 18,
    device_id: 'E4T7K2N1Z8',
    ip_address: '157.49.12.7',
    action_taken: 'User account temporarily restricted, 3 cards blacklisted',
    resolution: 'Confirmed as friendly fraud — customer used expired cards. Account restored.',
    resolved_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    resolved_by: 1,
    metadata: { card_bins: ['424242', '411111', '555555'], avs_mismatch: true, cvv_errors: 4 },
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 7,
    event_type: 'application_abuse',
    severity: 'high',
    status: 'open',
    title: 'Loan Stacking Detected',
    description: 'Active loan from competitor platform detected during credit check — loan stacking risk',
    detected_by: 'external_api',
    risk_score_delta: 32,
    user_id: 103,
    metadata: { bureau_alert: true, existing_emi_ratio: '>50%', inquiries_count: 4 },
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 8,
    event_type: 'document_forgery',
    severity: 'critical',
    status: 'confirmed',
    title: 'Forged Bank Statement',
    description: 'Bank statement submitted with digitally altered figures — transaction history mismatch detected',
    detected_by: 'system',
    risk_score_delta: 55,
    device_id: 'F9Z3X8C2L5',
    ip_address: '110.227.54.2',
    user_id: 104,
    action_taken: 'KYC rejected, account flagged for permanent ban review',
    resolution: 'Document verified as forged via Signzy API — metadata edited 3 times in PDF',
    resolved_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    resolved_by: 1,
    metadata: { pdf_metadata_edits: 3, font_mismatch: true, 'signzy_score': 12 },
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 9,
    event_type: 'collusion',
    severity: 'high',
    status: 'investigating',
    title: 'Agent-Borrower Collusion Ring',
    description: 'Same agent approved 8 loans from same IP range — all defaulted within first week',
    detected_by: 'system',
    risk_score_delta: 40,
    device_id: 'G8L4T6P3K1',
    ip_address: '103.95.82.0/24',
    action_taken: 'Agent suspended pending investigation, loans flagged for recovery',
    metadata: { agent_id: 12, approved_count: 8, default_rate: '100%', ip_range: '103.95.82.x' },
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 10,
    event_type: 'manual_review',
    severity: 'low',
    status: 'dismissed',
    title: 'False Positive — High-Value Customer',
    description: 'Triggered by large deposit from new account — flagged as money laundering risk',
    detected_by: 'system',
    risk_score_delta: 10,
    device_id: 'H6K1N9L2T4',
    ip_address: '202.14.71.30',
    action_taken: 'Reviewed and dismissed — customer provided legitimate source of funds',
    resolution: 'Verified via salary credit from listed employer account. No further action.',
    resolved_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    resolved_by: 2,
    metadata: { deposit_amount: 250000, source: 'salary_credit', verified_by: 'employer_bank_match' },
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Component ──

export default function AdminFraudScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  // ── Data ──
  const [events, setEvents] = useState<FraudEvent[]>(FALLBACK_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<FraudEvent | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ── Filters ──
  const [filterSeverity, setFilterSeverity] = useState<FraudSeverity | null>(null);
  const [filterStatus, setFilterStatus] = useState<FraudStatus | null>(null);
  // ── Health check loading (keep existing behavior) ──
  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null,
    1500,
  );

  // ── Filtered events ──
  const filteredEvents = useMemo(() => {
    let result = events;
    if (filterSeverity) result = result.filter((e) => e.severity === filterSeverity);
    if (filterStatus) result = result.filter((e) => e.status === filterStatus);
    return result;
  }, [events, filterSeverity, filterStatus]);

  // ── Derived counts ──
  const openCount = events.filter((e) => e.status === 'open').length;
  const criticalCount = events.filter((e) => e.severity === 'critical' && e.status !== 'resolved' && e.status !== 'dismissed').length;
  const highCount = events.filter((e) => e.severity === 'high' && e.status !== 'resolved' && e.status !== 'dismissed').length;

  // ── Handlers ──
  const handleStatusUpdate = async (eventId: number, newStatus: FraudStatus, resolution?: string) => {
    setUpdatingId(eventId);
    try {
      const result = await updateFraudEventStatus(eventId, newStatus, resolution);
      if (result.success) {
        setEvents((prev) => prev.map((e) =>
          e.id === eventId
            ? { ...e, status: newStatus, resolution: resolution || e.resolution, resolved_at: newStatus === 'resolved' || newStatus === 'dismissed' ? new Date().toISOString() : e.resolved_at }
            : e,
        ));
        setSelectedEvent((prev) =>
          prev?.id === eventId ? { ...prev, status: newStatus, resolution: resolution || prev.resolution } : prev,
        );
        Alert.alert('Updated', `Event marked as "${STATUS_CONFIG[newStatus].label}".`);
      } else {
        Alert.alert('Error', result.error || 'Failed to update event status.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setFilterSeverity(null);
    setFilterStatus(null);
  };

  const hasActiveFilters = filterSeverity || filterStatus;

  // ── Render ──

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.red }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Fraud Monitoring</Text>
          <Text style={styles.topNavSub}>{openCount} open events</Text>
        </View>
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>{criticalCount + highCount} critical</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : (
          <>
            {/* ── Critical Alert Banner ── */}
            {criticalCount > 0 && (
              <LinearGradient colors={['#A02020', '#D44040']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.alertBanner}>
                <Ionicons name="warning" size={24} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertBannerTitle}>Critical Alerts Require Attention</Text>
                  <Text style={styles.alertBannerSub}>{criticalCount} fraud events — review immediately</Text>
                </View>
              </LinearGradient>
            )}

            {/* ── Metrics ── */}
            <View style={styles.metricGrid}>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.red }]}>{events.filter((e) => e.status !== 'resolved' && e.status !== 'dismissed').length}</Text>
                <Text style={[styles.metricLabel, { color: colors.text3 }]}>Flagged</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.amber }]}>{openCount}</Text>
                <Text style={[styles.metricLabel, { color: colors.text3 }]}>Open</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.metricValue, { color: colors.green }]}>{events.filter((e) => e.status === 'resolved' || e.status === 'dismissed').length}</Text>
                <Text style={[styles.metricLabel, { color: colors.text3 }]}>Closed</Text>
              </View>
            </View>

            {/* ── Filter Pills ── */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                {/* Severity pills */}
                {SEVERITY_OPTIONS.map((s) => {
                  const active = filterSeverity === s;
                  const cfg = SEVERITY_CONFIG[s];
                  return (
                    <Pressable
                      key={`sev-${s}`}
                      style={({ pressed }) => [
                        styles.filterPill,
                        { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? cfg.bg : colors.surface },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setFilterSeverity(active ? null : s)}
                    >
                      <Ionicons name={cfg.icon} size={13} color={active ? cfg.color : colors.text3} />
                      <Text style={[styles.filterPillText, { color: active ? cfg.color : colors.text3 }]}>{s}</Text>
                    </Pressable>
                  );
                })}
                {/* Status pills */}
                {STATUS_OPTIONS.map((s) => {
                  const active = filterStatus === s;
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <Pressable
                      key={`st-${s}`}
                      style={({ pressed }) => [
                        styles.filterPill,
                        { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? `${cfg.color}18` : colors.surface },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setFilterStatus(active ? null : s)}
                    >
                      <View style={[styles.filterStatusDot, { backgroundColor: cfg.color }]} />
                      <Text style={[styles.filterPillText, { color: active ? cfg.color : colors.text3 }]}>{cfg.label}</Text>
                    </Pressable>
                  );
                })}
                {/* Clear filters */}
                {hasActiveFilters && (
                  <Pressable
                    style={({ pressed }) => [styles.filterPill, { borderColor: colors.red }, pressed && { opacity: 0.8 }]}
                    onPress={clearFilters}
                  >
                    <Ionicons name="close" size={13} color={colors.red} />
                    <Text style={[styles.filterPillText, { color: colors.red }]}>Clear</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>

            {/* ── Section Header ── */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Fraud Events</Text>
              <Text style={[styles.sectionCount, { color: colors.text3 }]}>{filteredEvents.length} of {events.length}</Text>
            </View>

            {filteredEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark-outline" size={40} color={colors.text3} />
                <Text style={[styles.emptyText, { color: colors.text3 }]}>No events match filters</Text>
              </View>
            ) : selectedEvent ? (
              /* ── Detail View ── */
              <DetailView
                event={selectedEvent}
                onBack={() => setSelectedEvent(null)}
                onStatusUpdate={handleStatusUpdate}
                updatingId={updatingId}
                colors={colors}
              />
            ) : (
              /* ── List View ── */
              filteredEvents.map((event) => (
                <ListItem
                  key={event.id}
                  event={event}
                  onPress={() => setSelectedEvent(event)}
                  colors={colors}
                />
              ))
            )}

            <View style={{ height: spacing.xl5 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── List Item ──

function ListItem({ event, onPress, colors }: { event: FraudEvent; onPress: () => void; colors: any }) {
  const sc = SEVERITY_CONFIG[event.severity];
  const ec = EVENT_TYPE_CONFIG[event.event_type];
  const dc = DETECTED_BY_CONFIG[event.detected_by];
  const rd = formatRiskDelta(event.risk_score_delta);
  const statusCfg = STATUS_CONFIG[event.status];

  return (
    <Pressable
      style={({ pressed }) => [styles.alertCard, {
        backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: sc.color,
      }, pressed && { opacity: 0.92 }]}
      onPress={onPress}
    >
      <View style={styles.alertRow}>
        {/* Event icon */}
        <View style={[styles.alertIcon, { backgroundColor: sc.bg }]}>
          <Ionicons name={ec.icon} size={20} color={sc.color} />
        </View>
        <View style={{ flex: 1 }}>
          {/* Title + severity badge */}
          <View style={styles.alertTypeRow}>
            <Text style={[styles.alertType, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
            <View style={[styles.alertSeverityBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.alertSeverityText, { color: sc.color }]}>{event.severity}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[styles.alertDesc, { color: colors.text3 }]} numberOfLines={1}>{event.description}</Text>

          {/* Meta row: detected_by badge + risk_score_delta + status */}
          <View style={styles.alertMetaRow}>
            {/* Detected by badge */}
            <View style={[styles.detectedByBadge, { backgroundColor: dc.bg }]}>
              <Ionicons name={dc.icon} size={10} color={dc.color} />
              <Text style={[styles.detectedByText, { color: dc.color }]}>{dc.label}</Text>
            </View>

            {/* Risk score delta */}
            <Text style={[styles.riskDelta, { color: rd.color }]}>{rd.text}</Text>

            {/* Status dot */}
            <View style={[styles.alertStatusDot, { backgroundColor: statusCfg.color }]} />
            <Text style={[styles.alertStatusText, { color: colors.text3 }]}>{statusCfg.label}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text3} style={{ marginLeft: spacing.sm }} />
      </View>
    </Pressable>
  );
}

// ── Detail View ──

function DetailView({
  event,
  onBack,
  onStatusUpdate,
  updatingId,
  colors,
}: {
  event: FraudEvent;
  onBack: () => void;
  onStatusUpdate: (id: number, status: FraudStatus, resolution?: string) => void;
  updatingId: number | null;
  colors: any;
}) {
  const sc = SEVERITY_CONFIG[event.severity];
  const ec = EVENT_TYPE_CONFIG[event.event_type];
  const dc = DETECTED_BY_CONFIG[event.detected_by];
  const rd = formatRiskDelta(event.risk_score_delta);
  const statusCfg = STATUS_CONFIG[event.status];
  const isPending = updatingId === event.id;

  // Resolve with a resolution prompt
  const handleResolve = () => {
    Alert.prompt
      ? Alert.prompt('Resolve Event', 'Enter resolution notes:', (text) => {
          onStatusUpdate(event.id, 'resolved', text || 'Resolved by admin');
        })
      : onStatusUpdate(event.id, 'resolved', 'Resolved by admin');
  };

  const handleDismiss = () => {
    onStatusUpdate(event.id, 'dismissed', 'Dismissed — false positive or no further action required');
  };

  return (
    <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Back button */}
      <Pressable onPress={onBack} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Back to events</Text>
      </Pressable>

      {/* Severity + status badge */}
      <View style={[styles.severityBadge, { backgroundColor: sc.bg }]}>
        <Ionicons name={sc.icon} size={16} color={sc.color} />
        <Text style={[styles.severityText, { color: sc.color }]}>{event.severity.toUpperCase()}</Text>
        <View style={[styles.statusDot2, { backgroundColor: statusCfg.color }]} />
        <Text style={[styles.severityText, { color: colors.text2 }]}>{statusCfg.label}</Text>
      </View>

      {/* Event type + detected_by */}
      <View style={styles.detailMetaRow}>
        <View style={[styles.detailMetaChip, { backgroundColor: colors.bg }]}>
          <Ionicons name={ec.icon} size={14} color={colors.text2} />
          <Text style={[styles.detailMetaText, { color: colors.text2 }]}>{ec.label}</Text>
        </View>
        <View style={[styles.detailMetaChip, { backgroundColor: dc.bg }]}>
          <Ionicons name={dc.icon} size={14} color={dc.color} />
          <Text style={[styles.detailMetaText, { color: dc.color }]}>by {dc.label}</Text>
        </View>
      </View>

      {/* Title + description */}
      <Text style={[styles.detailType, { color: colors.text }]}>{event.title}</Text>
      <Text style={[styles.detailDesc, { color: colors.text2 }]}>{event.description}</Text>

      {/* Detail fields grid */}
      <View style={[styles.detailGrid, { borderColor: colors.borderLight }]}>
        {/* Risk score delta */}
        <DetailField
          icon="trending-up-outline"
          label="Risk Delta"
          value={rd.text}
          valueColor={rd.color}
          colors={colors}
        />
        {/* Detected by */}
        <DetailField
          icon={dc.icon}
          label="Detected By"
          value={dc.label}
          valueColor={dc.color}
          colors={colors}
        />
        {/* Device ID */}
        {event.device_id && (
          <DetailField
            icon="phone-portrait-outline"
            label="Device ID"
            value={event.device_id}
            colors={colors}
          />
        )}
        {/* IP Address */}
        {event.ip_address && (
          <DetailField
            icon="globe-outline"
            label="IP Address"
            value={event.ip_address}
            colors={colors}
          />
        )}
        {/* User ID */}
        {event.user_id && (
          <DetailField
            icon="person-outline"
            label="User ID"
            value={`#${event.user_id}`}
            colors={colors}
          />
        )}
        {/* Loan ID */}
        {event.loan_id && (
          <DetailField
            icon="cash-outline"
            label="Loan ID"
            value={`#${event.loan_id}`}
            colors={colors}
          />
        )}
        {/* Created at */}
        <DetailField
          icon="time-outline"
          label="Detected"
          value={formatAge(event.created_at)}
          colors={colors}
        />
        {/* Resolved at */}
        {event.resolved_at && (
          <DetailField
            icon="checkmark-circle-outline"
            label="Resolved"
            value={formatAge(event.resolved_at)}
            colors={colors}
          />
        )}
      </View>

      {/* Action taken */}
      {event.action_taken && (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Action Taken</Text>
          <Text style={[styles.detailSectionValue, { color: colors.text }]}>{event.action_taken}</Text>
        </View>
      )}

      {/* Resolution */}
      {event.resolution && (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Resolution</Text>
          <View style={[styles.resolutionBox, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
            <Text style={[styles.detailSectionValue, { color: colors.green }]}>{event.resolution}</Text>
          </View>
        </View>
      )}

      {/* Metadata */}
      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionLabel, { color: colors.text3 }]}>Metadata</Text>
          <View style={[styles.metadataGrid, { backgroundColor: colors.bg, borderColor: colors.borderLight }]}>
            {Object.entries(event.metadata).map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={[styles.metadataKey, { color: colors.text3 }]}>{key}</Text>
                <Text style={[styles.metadataValue, { color: colors.text }]} numberOfLines={2}>{String(value)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Action buttons */}
      {event.status !== 'resolved' && event.status !== 'dismissed' && (
        <View style={styles.actionRow}>
          {event.status === 'open' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.amber }, pressed && { opacity: 0.85 }, isPending && styles.actionBtnDisabled]}
                onPress={() => onStatusUpdate(event.id, 'investigating')}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionText}>Start Investigation</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtnSecondary, { borderColor: colors.border }, pressed && { opacity: 0.7 }, isPending && styles.actionBtnDisabled]}
                onPress={handleDismiss}
                disabled={isPending}
              >
                <Text style={[styles.actionTextSecondary, { color: colors.text3 }]}>Dismiss</Text>
              </Pressable>
            </>
          )}
          {event.status === 'investigating' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }, isPending && styles.actionBtnDisabled]}
                onPress={handleResolve}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionText, { color: '#fff' }]}>Resolve</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }, isPending && styles.actionBtnDisabled]}
                onPress={() => onStatusUpdate(event.id, 'confirmed')}
                disabled={isPending}
              >
                <Text style={styles.actionText}>Confirm Fraud</Text>
              </Pressable>
            </>
          )}
          {event.status === 'confirmed' && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }, isPending && styles.actionBtnDisabled]}
              onPress={handleResolve}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.actionText, { color: '#fff' }]}>Resolve</Text>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ── Sub-components ──

function DetailField({
  icon,
  label,
  value,
  valueColor,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  colors: any;
}) {
  return (
    <View style={styles.detailField}>
      <Ionicons name={icon} size={14} color={colors.text3} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailFieldLabel, { color: colors.text3 }]}>{label}</Text>
        <Text style={[styles.detailFieldValue, { color: valueColor || colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

/** Format ISO date to relative age string */
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

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, gap: spacing.xl,
  },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
  alertBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.md + 2, paddingVertical: spacing.ssm, borderRadius: radii.full },
  alertBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  alertBanner: { margin: spacing.lg, borderRadius: radii.sm, padding: spacing.xl + 2, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  alertBannerTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  alertBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  metricGrid: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg },
  metricCard: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl, alignItems: 'center' },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 10, fontWeight: '600', marginTop: spacing.ssm, textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Filter pills ──
  filterRow: { marginTop: spacing.lg, marginBottom: spacing.sm },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterPillText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  filterStatusDot: { width: 6, height: 6, borderRadius: 3 },

  // ── Section header ──
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCount: { fontSize: 11, fontWeight: '500' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl5 },
  emptyText: { fontSize: 13, marginTop: spacing.md },

  // ── List item ──
  alertCard: {
    marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1,
    borderLeftWidth: 4, padding: spacing.xl + 2, marginBottom: spacing.smd,
  },
  alertRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  alertIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  alertTypeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  alertType: { fontWeight: '700', fontSize: 14, flex: 1 },
  alertSeverityBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full },
  alertSeverityText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  alertDesc: { fontSize: 11, marginTop: 1 },
  alertMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  detectedByBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full },
  detectedByText: { fontSize: 9, fontWeight: '700' },
  riskDelta: { fontSize: 10, fontWeight: '700' },
  alertStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  alertStatusText: { fontSize: 10, fontWeight: '500' },

  // ── Detail view ──
  detailCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginTop: spacing.smd },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  backText: { fontSize: 13, fontWeight: '600' },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, alignSelf: 'flex-start' },
  severityText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  statusDot2: { width: 6, height: 6, borderRadius: 3 },
  detailMetaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  detailMetaChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full },
  detailMetaText: { fontSize: 11, fontWeight: '600' },
  detailType: { fontSize: 18, fontWeight: '700', marginTop: spacing.lg },
  detailDesc: { fontSize: 13, marginTop: spacing.sm, lineHeight: 20 },
  detailGrid: { marginTop: spacing.xl4, borderWidth: 1, borderRadius: radii.sm, overflow: 'hidden' },
  detailField: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.smd,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 2,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  detailFieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailFieldValue: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  detailSection: { marginTop: spacing.xl4 },
  detailSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.smd },
  detailSectionValue: { fontSize: 13, lineHeight: 20 },
  resolutionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.smd, padding: spacing.xl, borderRadius: radii.sm, borderWidth: 1 },
  metadataGrid: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  metadataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  metadataKey: { fontSize: 11, fontWeight: '500', flex: 1 },
  metadataValue: { fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'right' },
  actionRow: { gap: spacing.smd, marginTop: spacing.xl4 },
  actionBtn: { paddingVertical: spacing.xl + 2, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  actionBtnDisabled: { opacity: 0.5 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  actionBtnSecondary: { paddingVertical: spacing.xl + 2, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  actionTextSecondary: { fontSize: 13, fontWeight: '700' },
});
