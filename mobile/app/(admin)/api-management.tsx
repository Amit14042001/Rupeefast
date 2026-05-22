/**
 * RupeeFast — Admin API Management Console
 *
 * Four-section screen:
 *   ── API Keys: List, create, rotate, revoke third-party service keys
 *   ── Webhooks: Event log with status, analytics, replay capability
 *   ── Services: Health check dashboard with uptime stats
 *   ── Integrations: Third-party service config, toggle, feature flags
 *
 * Layout:
 *   ┌─ Top Nav ────────────────────────────────────────────┐
 *   ├─ Tab Row: [API Keys | Webhooks | Services | Config]  │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 *   │  API Keys: Cards by service with status badges       │
 *   │  Create/Rotate/Revoke actions + raw value show       │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 *   │  Webhooks: Filtered event list, analytics summary    │
 *   │  Tap for detail → provider, event type, replay       │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 *   │  Services: Health grid (up/degraded/down/unknown)    │
 *   │  Per-service response time, last checked, run check  │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
 *   │  Config: Integration list with toggle, URL, features │
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

interface ApiKey {
  id: number;
  service_name: string;
  key_label: string;
  key_prefix: string;
  environment: string;
  status: 'active' | 'expired' | 'revoked' | 'rotated';
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  rotated_at: string | null;
  notes: string | null;
  created_by_name: string | null;
}

interface WebhookLog {
  id: number;
  provider: string;
  event_type: string;
  event_id: string | null;
  status: 'received' | 'processed' | 'failed' | 'replayed' | 'ignored';
  http_status: number | null;
  error_message: string | null;
  processing_time_ms: number | null;
  source_ip: string | null;
  parsed_body: Record<string, any> | null;
  created_at: string;
  processed_at: string | null;
}

interface WebhookAnalytics {
  totals: { total_all: number; total_processed: number; total_failed: number; total_pending: number };
  byProvider: { provider: string; total: number; processed: number; failed: number; avg_ms: number }[];
  hourly: { hour: string; total: number; failures: number }[];
}

interface ServiceHealth {
  id: number;
  service_name: string;
  status: 'up' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number | null;
  endpoint_tested: string | null;
  error_message: string | null;
  details: Record<string, any> | null;
  checked_by: string | null;
  created_at: string | null;
}

interface UptimeStat {
  service_name: string;
  total_checks: number;
  up_count: number;
  degraded_count: number;
  down_count: number;
  uptime_pct: number;
  avg_response_ms: number;
}

interface IntegrationConfig {
  id: number;
  service_name: string;
  display_name: string;
  base_url: string | null;
  config: Record<string, any>;
  is_enabled: boolean;
  feature_flags: Record<string, any>;
  current_status: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookListResult {
  logs: WebhookLog[];
  total: number;
  page: number;
  pages: number;
}

// ── Section tabs ──

const SECTIONS = [
  { key: 'keys', label: 'API Keys', icon: 'key-outline' as const },
  { key: 'webhooks', label: 'Webhooks', icon: 'git-branch-outline' as const },
  { key: 'services', label: 'Services', icon: 'pulse-outline' as const },
  { key: 'config', label: 'Config', icon: 'options-outline' as const },
];

// ── Fallback / Demo Data ──

const FALLBACK_KEYS: ApiKey[] = [
  { id: 1, service_name: 'razorpay', key_label: 'Razorpay Live', key_prefix: 'rzp_live_***', environment: 'production', status: 'active', expires_at: null, last_used_at: '2025-04-05T10:30:00Z', created_at: '2024-06-01T00:00:00Z', rotated_at: null, notes: null, created_by_name: 'Admin' },
  { id: 2, service_name: 'sms_gateway', key_label: 'MSG91 Production', key_prefix: 'ms91_***', environment: 'production', status: 'active', expires_at: null, last_used_at: '2025-04-05T09:15:00Z', created_at: '2024-08-15T00:00:00Z', rotated_at: null, notes: 'Main SMS provider', created_by_name: 'Admin' },
  { id: 3, service_name: 'whatsapp', key_label: 'Gupshup API', key_prefix: 'gup_***', environment: 'production', status: 'active', expires_at: null, last_used_at: '2025-04-04T18:00:00Z', created_at: '2024-09-01T00:00:00Z', rotated_at: null, notes: null, created_by_name: 'Admin' },
  { id: 4, service_name: 'kyc_provider', key_label: 'Signzy API', key_prefix: 'sig_***', environment: 'production', status: 'active', expires_at: null, last_used_at: '2025-04-03T14:20:00Z', created_at: '2024-07-01T00:00:00Z', rotated_at: null, notes: 'Aadhaar e-KYC + PAN verification', created_by_name: 'Admin' },
  { id: 5, service_name: 'razorpay', key_label: 'Razorpay Test', key_prefix: 'rzp_test_***', environment: 'development', status: 'active', expires_at: null, last_used_at: '2025-04-05T08:00:00Z', created_at: '2024-06-01T00:00:00Z', rotated_at: null, notes: null, created_by_name: 'Dev' },
  { id: 6, service_name: 'sms_gateway', key_label: 'MSG91 Old Key', key_prefix: 'ms91_***', environment: 'production', status: 'rotated', expires_at: null, last_used_at: '2025-01-15T00:00:00Z', created_at: '2024-03-01T00:00:00Z', rotated_at: '2024-08-15T00:00:00Z', notes: 'Rotated to key #2', created_by_name: 'Admin' },
];

const FALLBACK_WEBHOOK_LOGS: WebhookLog[] = [
  { id: 1, provider: 'razorpay', event_type: 'subscription.charged', event_id: 'evt_001', status: 'processed', http_status: 200, error_message: null, processing_time_ms: 45, source_ip: '52.66.65.101', parsed_body: { event: 'subscription.charged', payload: { payment: { entity: { id: 'pay_001', amount: 12000 } } } }, created_at: '2025-04-05T10:30:00Z', processed_at: '2025-04-05T10:30:01Z' },
  { id: 2, provider: 'razorpay', event_type: 'subscription.activated', event_id: 'evt_002', status: 'processed', http_status: 200, error_message: null, processing_time_ms: 32, source_ip: '52.66.65.101', parsed_body: { event: 'subscription.activated' }, created_at: '2025-04-05T09:15:00Z', processed_at: '2025-04-05T09:15:01Z' },
  { id: 3, provider: 'razorpay', event_type: 'payment.captured', event_id: 'evt_003', status: 'failed', http_status: 500, error_message: 'Database connection timeout', processing_time_ms: 5023, source_ip: '52.66.65.102', parsed_body: { event: 'payment.captured' }, created_at: '2025-04-04T18:00:00Z', processed_at: null },
  { id: 4, provider: 'razorpay', event_type: 'subscription.completed', event_id: 'evt_004', status: 'processed', http_status: 200, error_message: null, processing_time_ms: 28, source_ip: '52.66.65.101', parsed_body: { event: 'subscription.completed' }, created_at: '2025-04-04T14:20:00Z', processed_at: '2025-04-04T14:20:01Z' },
  { id: 5, provider: 'sms_dlr', event_type: 'delivery', event_id: 'dlr_001', status: 'received', http_status: null, error_message: null, processing_time_ms: null, source_ip: '103.21.244.10', parsed_body: { status: 'delivered', message_id: 'msg_001' }, created_at: '2025-04-05T11:00:00Z', processed_at: null },
  { id: 6, provider: 'razorpay', event_type: 'subscription.halted', event_id: 'evt_005', status: 'ignored', http_status: 200, error_message: null, processing_time_ms: 15, source_ip: '52.66.65.101', parsed_body: { event: 'subscription.halted', payload: { subscription: { entity: { id: 'sub_005' } } } }, created_at: '2025-04-03T10:00:00Z', processed_at: '2025-04-03T10:00:01Z' },
];

const FALLBACK_WEBHOOK_ANALYTICS: WebhookAnalytics = {
  totals: { total_all: 156, total_processed: 148, total_failed: 5, total_pending: 3 },
  byProvider: [
    { provider: 'razorpay', total: 142, processed: 136, failed: 4, avg_ms: 38 },
    { provider: 'sms_dlr', total: 12, processed: 10, failed: 1, avg_ms: 120 },
    { provider: 'whatsapp_dlr', total: 2, processed: 2, failed: 0, avg_ms: 85 },
  ],
  hourly: [
    { hour: '2025-04-05T08:00:00Z', total: 12, failures: 0 },
    { hour: '2025-04-05T09:00:00Z', total: 18, failures: 1 },
    { hour: '2025-04-05T10:00:00Z', total: 8, failures: 0 },
  ],
};

const FALLBACK_SERVICES: ServiceHealth[] = [
  { id: 1, service_name: 'razorpay_api', status: 'up', response_time_ms: 234, endpoint_tested: 'https://api.razorpay.com/v1/plans', error_message: null, details: null, checked_by: 'system', created_at: '2025-04-05T11:00:00Z' },
  { id: 2, service_name: 'sms_gateway', status: 'up', response_time_ms: 412, endpoint_tested: 'https://api.msg91.com/api/health', error_message: null, details: null, checked_by: 'system', created_at: '2025-04-05T10:55:00Z' },
  { id: 3, service_name: 'whatsapp_api', status: 'degraded', response_time_ms: 2801, endpoint_tested: 'https://api.gupshup.io/sm/api/health', error_message: 'Response time > 2s', details: null, checked_by: 'system', created_at: '2025-04-05T10:50:00Z' },
  { id: 4, service_name: 'kyc_provider', status: 'down', response_time_ms: null, endpoint_tested: 'https://e-kyc.signzy.com/api/health', error_message: 'Connection refused', details: null, checked_by: 'system', created_at: '2025-04-05T10:45:00Z' },
  { id: 5, service_name: 'postgres', status: 'up', response_time_ms: 5, endpoint_tested: 'localhost:5432', error_message: null, details: null, checked_by: 'system', created_at: '2025-04-05T11:00:00Z' },
  { id: 6, service_name: 'redis', status: 'up', response_time_ms: 2, endpoint_tested: 'localhost:6379', error_message: null, details: null, checked_by: 'system', created_at: '2025-04-05T11:00:00Z' },
];

const FALLBACK_UPTIME: UptimeStat[] = [
  { service_name: 'razorpay_api', total_checks: 168, up_count: 166, degraded_count: 1, down_count: 1, uptime_pct: 98.8, avg_response_ms: 210 },
  { service_name: 'sms_gateway', total_checks: 84, up_count: 80, degraded_count: 3, down_count: 1, uptime_pct: 95.2, avg_response_ms: 380 },
  { service_name: 'whatsapp_api', total_checks: 84, up_count: 72, degraded_count: 8, down_count: 4, uptime_pct: 85.7, avg_response_ms: 1100 },
  { service_name: 'kyc_provider', total_checks: 84, up_count: 68, degraded_count: 6, down_count: 10, uptime_pct: 81.0, avg_response_ms: 890 },
  { service_name: 'postgres', total_checks: 336, up_count: 336, degraded_count: 0, down_count: 0, uptime_pct: 100.0, avg_response_ms: 4 },
  { service_name: 'redis', total_checks: 336, up_count: 335, degraded_count: 1, down_count: 0, uptime_pct: 99.7, avg_response_ms: 2 },
];

const FALLBACK_INTEGRATIONS: IntegrationConfig[] = [
  { id: 1, service_name: 'razorpay', display_name: 'Razorpay', base_url: 'https://api.razorpay.com/v1', config: { version: 'v1', timeout: 10000 }, is_enabled: true, feature_flags: { auto_repayment: true, mandates: true, webhooks: true }, current_status: 'up', last_checked_at: '2025-04-05T11:00:00Z', created_at: '2024-06-01T00:00:00Z', updated_at: '2025-03-01T00:00:00Z' },
  { id: 2, service_name: 'sms_gateway', display_name: 'MSG91', base_url: 'https://api.msg91.com/api', config: { sender_id: 'RPFAST', route: 4 }, is_enabled: true, feature_flags: { transactional: true, promotional: false, otp: true }, current_status: 'up', last_checked_at: '2025-04-05T10:55:00Z', created_at: '2024-08-15T00:00:00Z', updated_at: '2025-02-15T00:00:00Z' },
  { id: 3, service_name: 'whatsapp', display_name: 'Gupshup WhatsApp', base_url: 'https://api.gupshup.io/sm/api', config: { app_name: 'RupeeFast', channel: 'whatsapp' }, is_enabled: true, feature_flags: { templates: true, media: false, interactive: true }, current_status: 'degraded', last_checked_at: '2025-04-05T10:50:00Z', created_at: '2024-09-01T00:00:00Z', updated_at: '2025-03-15T00:00:00Z' },
  { id: 4, service_name: 'kyc_provider', display_name: 'Signzy e-KYC', base_url: 'https://e-kyc.signzy.com/api', config: { mode: 'live', aadhaar_ekyc: true, pan_verify: true, digilocker: false }, is_enabled: true, feature_flags: { aadhaar_ocr: true, pan_auto: true, face_match: true }, current_status: 'down', last_checked_at: '2025-04-05T10:45:00Z', created_at: '2024-07-01T00:00:00Z', updated_at: '2025-03-10T00:00:00Z' },
];

// ── Helpers ──

const SERVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  razorpay_api: 'card-outline',
  razorpay: 'card-outline',
  sms_gateway: 'chatbubbles-outline',
  whatsapp_api: 'logo-whatsapp',
  whatsapp: 'logo-whatsapp',
  kyc_provider: 'shield-checkmark-outline',
  postgres: 'server-outline',
  redis: 'server-outline',
};

const STATUS_COLORS: Record<string, string> = {
  up: '#0B6B4A',
  degraded: '#9A6200',
  down: '#A02020',
  unknown: '#6B7280',
};

const STATUS_BG: Record<string, string> = {
  up: '#0B6B4A15',
  degraded: '#9A620015',
  down: '#A0202015',
  unknown: '#6B728015',
};

const WEBHOOK_STATUS_COLORS: Record<string, string> = {
  processed: '#0B6B4A',
  failed: '#A02020',
  received: '#2562A8',
  replayed: '#5A3E9B',
  ignored: '#6B7280',
};

// ══════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════

export default function AdminApiManagementScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [section, setSection] = useState('keys');

  // ── API Keys state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyService, setNewKeyService] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyEnv, setNewKeyEnv] = useState('production');
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ rawValue: string; label: string } | null>(null);
  const [filterService, setFilterService] = useState('');

  // ── Webhooks state ──
  const [webhookFilterProvider, setWebhookFilterProvider] = useState('');
  const [webhookFilterStatus, setWebhookFilterStatus] = useState('');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookLog | null>(null);

  // ── Services state ──
  const [checkingService, setCheckingService] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // ── Config state ──
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  // ── Data fetching ──
  const keysFetcher = useCallback(async () => {
    const params = filterService ? `?service_name=${filterService}` : '';
    const result = await apiFetch<ApiKey[]>(ENDPOINTS.API_KEYS + params);
    if (result.success && Array.isArray(result.data)) return result.data;
    return null;
  }, [filterService]);

  const webhooksFetcher = useCallback(async () => {
    const params = new URLSearchParams();
    if (webhookFilterProvider) params.set('provider', webhookFilterProvider);
    if (webhookFilterStatus) params.set('status', webhookFilterStatus);
    params.set('limit', '20');
    const result = await apiFetch<WebhookListResult>(`${ENDPOINTS.WEBHOOK_LOGS}?${params.toString()}`);
    if (result.success && result.data) return result.data.logs;
    return null;
  }, [webhookFilterProvider, webhookFilterStatus]);

  const webhookAnalyticsFetcher = useCallback(async () => {
    const result = await apiFetch<WebhookAnalytics>(ENDPOINTS.WEBHOOK_ANALYTICS);
    if (result.success && result.data) return result.data;
    return null;
  }, []);

  const servicesFetcher = useCallback(async () => {
    const result = await apiFetch<{ services: ServiceHealth[]; uptime: UptimeStat[] }>(ENDPOINTS.SERVICES_HEALTH);
    if (result.success && result.data) return result.data;
    return null;
  }, []);

  const integrationsFetcher = useCallback(async () => {
    const result = await apiFetch<IntegrationConfig[]>(ENDPOINTS.INTEGRATIONS);
    if (result.success && Array.isArray(result.data)) return result.data;
    return null;
  }, []);

  const { data: keys, loading: keysLoading, refresh: refreshKeys } = useTimedAsyncData(keysFetcher, FALLBACK_KEYS, 5000);
  const { data: webhookResult, loading: webhooksLoading } = useTimedAsyncData(webhooksFetcher, FALLBACK_WEBHOOK_LOGS, 5000);
  const { data: analytics } = useTimedAsyncData(webhookAnalyticsFetcher, FALLBACK_WEBHOOK_ANALYTICS, 5000);
  const { data: healthData, loading: healthLoading, refresh: refreshHealth } = useTimedAsyncData(servicesFetcher, { services: FALLBACK_SERVICES, uptime: FALLBACK_UPTIME }, 5000);
  const { data: integrations, loading: integrationsLoading, refresh: refreshIntegrations } = useTimedAsyncData(integrationsFetcher, FALLBACK_INTEGRATIONS, 5000);

  // ── API Key Actions ──

  const handleCreateKey = useCallback(async () => {
    if (!newKeyService.trim() || !newKeyLabel.trim()) {
      Alert.alert('Error', 'Service name and label are required.');
      return;
    }
    const result = await apiFetch<{ key: ApiKey; raw_value: string }>(ENDPOINTS.API_KEYS_CREATE, {
      method: 'POST',
      body: { service_name: newKeyService.trim(), key_label: newKeyLabel.trim(), environment: newKeyEnv, notes: newKeyNotes.trim() || undefined },
    });
    if (result.success && result.data) {
      setRevealedKey({ rawValue: result.data.raw_value, label: result.data.key.key_label });
      setShowCreateForm(false);
      setNewKeyService('');
      setNewKeyLabel('');
      setNewKeyNotes('');
      refreshKeys();
    } else if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to create key');
    }
  }, [newKeyService, newKeyLabel, newKeyEnv, newKeyNotes, refreshKeys]);

  const handleRotateKey = useCallback(async (key: ApiKey) => {
    Alert.alert(
      'Rotate Key',
      `This will revoke "${key.key_label}" and create a new one. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rotate', style: 'destructive', onPress: async () => {
          const result = await apiFetch<{ raw_value: string; new_key: ApiKey }>(ENDPOINTS.API_KEYS_ROTATE(key.id), { method: 'POST' });
          if (result.success && result.data) {
            setRevealedKey({ rawValue: result.data.raw_value, label: result.data.new_key.key_label });
            refreshKeys();
          } else if (!result.success) {
            Alert.alert('Error', result.error || 'Failed to rotate key');
          }
        }},
      ]
    );
  }, [refreshKeys]);

  const handleRevokeKey = useCallback(async (key: ApiKey) => {
    Alert.alert(
      'Revoke Key',
      `Are you sure you want to revoke "${key.key_label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: async () => {
          const result = await apiFetch(ENDPOINTS.API_KEYS_REVOKE(key.id), { method: 'POST' });
          if (result.success) {
            refreshKeys();
          } else if (!result.success) {
            Alert.alert('Error', result.error || 'Failed to revoke key');
          }
        }},
      ]
    );
  }, [refreshKeys]);

  // ── Webhook Actions ──

  const handleReplayWebhook = useCallback(async (webhook: WebhookLog) => {
    const result = await apiFetch(ENDPOINTS.WEBHOOK_REPLAY(webhook.id), { method: 'POST' });
    if (result.success) {
      Alert.alert('Replayed', 'Webhook event has been re-queued for processing.');
    } else if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to replay webhook');
    }
  }, []);

  // ── Service Actions ──

  const handleRunCheck = useCallback(async (serviceName: string) => {
    setCheckingService(serviceName);
    const result = await apiFetch(ENDPOINTS.SERVICE_CHECK(serviceName), { method: 'POST' });
    setCheckingService(null);
    if (result.success) {
      refreshHealth();
    } else if (!result.success) {
      Alert.alert('Error', result.error || 'Health check failed');
    }
  }, [refreshHealth]);

  const handleRunAllChecks = useCallback(async () => {
    setCheckingAll(true);
    const result = await apiFetch(ENDPOINTS.SERVICES_CHECK_ALL, { method: 'POST' });
    setCheckingAll(false);
    if (result.success) {
      refreshHealth();
    } else if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to run checks');
    }
  }, [refreshHealth]);

  // ── Integration Actions ──

  const handleToggleIntegration = useCallback(async (serviceName: string, currentEnabled: boolean) => {
    const result = await apiFetch(ENDPOINTS.INTEGRATION_TOGGLE(serviceName), {
      method: 'POST',
      body: { is_enabled: !currentEnabled },
    });
    if (result.success) {
      refreshIntegrations();
    } else if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to toggle integration');
    }
  }, [refreshIntegrations]);

  // ── Helpers ──

  const getServiceIcon = (name: string) => {
    return SERVICE_ICONS[name] || 'code-outline';
  };

  const getStatusBadge = (status: string) => (
    <View style={[styles.smallBadge, { backgroundColor: STATUS_BG[status] || STATUS_BG.unknown }]}>
      <View style={[styles.statusDotSm, { backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.unknown }]} />
      <Text style={[styles.smallBadgeText, { color: STATUS_COLORS[status] || STATUS_COLORS.unknown }]}>
        {status}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Ionicons name="code-slash-outline" size={20} color={colors.primary} />
        <Text style={[styles.topNavTitle, { color: colors.text }]}>API Management</Text>
      </View>

      {/* ── Section Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
      >
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={({ pressed }) => [
              styles.sectionTab,
              { backgroundColor: section === s.key ? colors.primary : 'transparent' },
              pressed && section !== s.key && { backgroundColor: colors.surfaceHover },
            ]}
            onPress={() => { setSection(s.key); setSelectedWebhook(null); }}
          >
            <Ionicons name={s.icon as any} size={16} color={section === s.key ? '#fff' : colors.text3} />
            <Text style={[styles.sectionTabLabel, { color: section === s.key ? '#fff' : colors.text3 }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ═══════════ API KEYS ═══════════ */}
        {section === 'keys' && (
          <>
            {/* ── Revealed Key Banner ── */}
            {revealedKey && (
              <View style={[styles.revealBanner, { backgroundColor: '#0B6B4A15', borderColor: '#0B6B4A' }]}>
                <Ionicons name="key" size={20} color="#0B6B4A" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.revealTitle, { color: '#0B6B4A' }]}>New Key Created: {revealedKey.label}</Text>
                  <Text style={[styles.revealValue, { color: '#0B6B4A' }]} selectable>{revealedKey.rawValue}</Text>
                  <Text style={[styles.revealHint, { color: '#0B6B4A' }]}>Copy this now — it will not be shown again.</Text>
                </View>
                <Pressable onPress={() => setRevealedKey(null)}>
                  <Ionicons name="close" size={20} color="#0B6B4A" />
                </Pressable>
              </View>
            )}

            {/* ── Filters & Create ── */}
            <View style={styles.actionRow}>
              <View style={[styles.serviceFilter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={14} color={colors.text3} />
                <TextInput
                  style={[styles.filterInputSm, { color: colors.text }]}
                  placeholder="Filter by service..."
                  placeholderTextColor={colors.text3}
                  value={filterService}
                  onChangeText={setFilterService}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                onPress={() => setShowCreateForm(!showCreateForm)}
              >
                <Ionicons name={showCreateForm ? 'close' : 'add'} size={18} color="#fff" />
                <Text style={styles.actionBtnText}>{showCreateForm ? 'Close' : 'New Key'}</Text>
              </Pressable>
            </View>

            {/* ── Create Form ── */}
            {showCreateForm && (
              <View style={[styles.createForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.createFormTitle, { color: colors.text }]}>Create API Key</Text>
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Service Name</Text>
                    <TextInput
                      style={[styles.formInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
                      placeholder="e.g., razorpay, sms_gateway"
                      placeholderTextColor={colors.text3}
                      value={newKeyService}
                      onChangeText={setNewKeyService}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={{ width: spacing.xxl }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Environment</Text>
                    <View style={styles.envRow}>
                      {['development', 'staging', 'production'].map((env) => (
                        <Pressable
                          key={env}
                          style={({ pressed }) => [
                            styles.envChip,
                            { backgroundColor: newKeyEnv === env ? colors.primary : colors.bg, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => setNewKeyEnv(env)}
                        >
                          <Text style={[styles.envChipText, { color: newKeyEnv === env ? '#fff' : colors.text, fontSize: 10 }]}>
                            {env}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={[styles.fieldLabel, { color: colors.text3 }]}>Label</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
                  placeholder="e.g., Razorpay Live"
                  placeholderTextColor={colors.text3}
                  value={newKeyLabel}
                  onChangeText={setNewKeyLabel}
                />
                <Text style={[styles.fieldLabel, { color: colors.text3, marginTop: spacing.md }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }]}
                  placeholder="Any notes..."
                  placeholderTextColor={colors.text3}
                  value={newKeyNotes}
                  onChangeText={setNewKeyNotes}
                />
                <Pressable
                  style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                  onPress={handleCreateKey}
                >
                  <Ionicons name="key" size={16} color="#fff" />
                  <Text style={styles.createBtnText}>Generate Key</Text>
                </Pressable>
              </View>
            )}

            {/* ── Key Cards ── */}
            {keysLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
            ) : (keys || []).length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="key-outline" size={40} color={colors.text3} />
                <Text style={[styles.emptyText, { color: colors.text3 }]}>No API keys found</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl3 }}>
                {/* Group by service */}
                {Object.entries(
                  (keys || []).reduce((acc: Record<string, ApiKey[]>, key) => {
                    const group = key.service_name;
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(key);
                    return acc;
                  }, {})
                ).map(([service, serviceKeys]) => (
                  <View key={service} style={[styles.serviceGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.serviceGroupHeader}>
                      <Ionicons name={getServiceIcon(service)} size={18} color={colors.text} />
                      <Text style={[styles.serviceGroupTitle, { color: colors.text }]}>{service}</Text>
                      <View style={[styles.keyCount, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.keyCountText, { color: colors.text3 }]}>{serviceKeys.length}</Text>
                      </View>
                    </View>
                    {serviceKeys.map((key) => (
                      <View key={key.id} style={[styles.keyCard, { borderTopColor: colors.borderLight }]}>
                        <View style={styles.keyHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.keyTitleRow}>
                              <Text style={[styles.keyLabel, { color: colors.text }]}>{key.key_label}</Text>
                              <View style={[styles.statusBadge, { backgroundColor: key.status === 'active' ? '#0B6B4A15' : '#6B728015' }]}>
                                <View style={[styles.statusDot, { backgroundColor: key.status === 'active' ? '#0B6B4A' : '#6B7280' }]} />
                                <Text style={[styles.statusText, { color: key.status === 'active' ? '#0B6B4A' : '#6B7280' }]}>{key.status}</Text>
                              </View>
                            </View>
                            <View style={styles.keyMeta}>
                              <Text style={[styles.keyMetaText, { color: colors.text3 }]}>Prefix: {key.key_prefix}</Text>
                              <Text style={[styles.keyMetaDot, { color: colors.text3 }]}>·</Text>
                              <Text style={[styles.keyMetaText, { color: colors.text3 }]}>{key.environment}</Text>
                              {key.last_used_at && (
                                <>
                                  <Text style={[styles.keyMetaDot, { color: colors.text3 }]}>·</Text>
                                  <Text style={[styles.keyMetaText, { color: colors.text3 }]}>
                                    Last: {new Date(key.last_used_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>
                          <View style={styles.keyActions}>
                            {key.status === 'active' && (
                              <>
                                <Pressable
                                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                                  onPress={() => handleRotateKey(key)}
                                >
                                  <Ionicons name="refresh" size={16} color={colors.primary} />
                                </Pressable>
                                <Pressable
                                  style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
                                  onPress={() => handleRevokeKey(key)}
                                >
                                  <Ionicons name="trash-outline" size={16} color={colors.red} />
                                </Pressable>
                              </>
                            )}
                          </View>
                        </View>
                        {key.notes && (
                          <Text style={[styles.keyNotes, { color: colors.text2 }]}>{key.notes}</Text>
                        )}
                        {key.rotated_at && (
                          <Text style={[styles.keyRotated, { color: colors.text3 }]}>
                            Rotated: {new Date(key.rotated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ═══════════ WEBHOOKS ═══════════ */}
        {section === 'webhooks' && (
          <>
            {selectedWebhook ? (
              /* ── Webhook Detail ── */
              <View>
                <Pressable
                  style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedWebhook(null)}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.primary} />
                  <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to List</Text>
                </Pressable>

                <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.detailHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedWebhook.event_type}</Text>
                      <Text style={[styles.detailSubtitle, { color: colors.text3 }]}>
                        Provider: {selectedWebhook.provider}
                        {selectedWebhook.event_id ? ` · ID: ${selectedWebhook.event_id}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${WEBHOOK_STATUS_COLORS[selectedWebhook.status]}15` }]}>
                      <View style={[styles.statusDot, { backgroundColor: WEBHOOK_STATUS_COLORS[selectedWebhook.status] }]} />
                      <Text style={[styles.statusText, { color: WEBHOOK_STATUS_COLORS[selectedWebhook.status] }]}>
                        {selectedWebhook.status}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.webhookDetailGrid, { borderTopColor: colors.borderLight }]}>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailField, { color: colors.text3 }]}>Source IP</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{selectedWebhook.source_ip || '-'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailField, { color: colors.text3 }]}>HTTP Status</Text>
                      <Text style={[styles.detailValue, { color: selectedWebhook.http_status && selectedWebhook.http_status >= 400 ? colors.red : colors.text }]}>
                        {selectedWebhook.http_status || '-'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailField, { color: colors.text3 }]}>Processing Time</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {selectedWebhook.processing_time_ms ? `${selectedWebhook.processing_time_ms}ms` : '-'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailField, { color: colors.text3 }]}>Received</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {new Date(selectedWebhook.created_at).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    {selectedWebhook.processed_at && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailField, { color: colors.text3 }]}>Processed</Text>
                        <Text style={[styles.detailValue, { color: colors.text }]}>
                          {new Date(selectedWebhook.processed_at).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                    {selectedWebhook.error_message && (
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailField, { color: colors.red }]}>Error</Text>
                        <Text style={[styles.detailValue, { color: colors.red }]}>{selectedWebhook.error_message}</Text>
                      </View>
                    )}
                  </View>

                  {/* Replay button */}
                  <Pressable
                    style={({ pressed }) => [styles.replayBtn, { borderTopColor: colors.borderLight }, pressed && { opacity: 0.8 }]}
                    onPress={() => handleReplayWebhook(selectedWebhook)}
                  >
                    <Ionicons name="refresh" size={16} color={colors.primary} />
                    <Text style={[styles.replayBtnText, { color: colors.primary }]}>Replay Webhook Event</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                {/* ── Analytics Summary ── */}
                {analytics && (
                  <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.summaryTitle, { color: colors.text3 }]}>Webhook Analytics (7 days)</Text>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: colors.text }]}>{analytics.totals.total_all}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Total</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: colors.green }]}>{analytics.totals.total_processed}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Processed</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: analytics.totals.total_failed > 0 ? colors.red : colors.green }]}>{analytics.totals.total_failed}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Failed</Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: colors.primary }]}>{analytics.totals.total_pending}</Text>
                        <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Pending</Text>
                      </View>
                    </View>

                    {/* Per-provider breakdown */}
                    <View style={[styles.providerBreakdown, { borderTopColor: colors.borderLight }]}>
                      {analytics.byProvider.map((p) => (
                        <View key={p.provider} style={styles.providerRow}>
                          <Text style={[styles.providerName, { color: colors.text }]}>{p.provider}</Text>
                          <View style={styles.providerStats}>
                            <Text style={[styles.providerStat, { color: colors.green }]}>{p.processed} ok</Text>
                            <Text style={[styles.providerStatSep, { color: colors.text3 }]}>/</Text>
                            <Text style={[styles.providerStat, { color: p.failed > 0 ? colors.red : colors.text }]}>{p.failed} fail</Text>
                            <Text style={[styles.providerStatSep, { color: colors.text3 }]}>·</Text>
                            <Text style={[styles.providerStat, { color: colors.text3 }]}>{p.avg_ms}ms avg</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Filters ── */}
                <View style={styles.filterRow}>
                  <View style={[styles.filterChipRow, { gap: spacing.sm }]}>
                    {['', 'razorpay', 'sms_dlr', 'whatsapp_dlr'].map((p) => (
                      <Pressable
                        key={p || 'all'}
                        style={({ pressed }) => [
                          styles.filterChip,
                          { backgroundColor: webhookFilterProvider === p ? colors.primary : colors.surface, borderColor: colors.border },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => setWebhookFilterProvider(p)}
                      >
                        <Text style={[styles.filterChipText, { color: webhookFilterProvider === p ? '#fff' : colors.text }]}>
                          {p || 'All Providers'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.filterRow}>
                  <View style={[styles.filterChipRow, { gap: spacing.sm }]}>
                    {['', 'processed', 'failed', 'received', 'ignored'].map((s) => (
                      <Pressable
                        key={s || 'all'}
                        style={({ pressed }) => [
                          styles.filterChip,
                          { backgroundColor: webhookFilterStatus === s ? colors.primary : colors.surface, borderColor: colors.border },
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => setWebhookFilterStatus(s)}
                      >
                        <Text style={[styles.filterChipText, { color: webhookFilterStatus === s ? '#fff' : colors.text }]}>
                          {s || 'All Status'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* ── Webhook Log List ── */}
                {webhooksLoading ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
                ) : (webhookResult || []).length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="git-branch-outline" size={40} color={colors.text3} />
                    <Text style={[styles.emptyText, { color: colors.text3 }]}>No webhook events found</Text>
                  </View>
                ) : (
                  <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {(webhookResult || []).map((w, i) => (
                      <Pressable
                        key={w.id}
                        style={({ pressed }) => [
                          styles.listItem,
                          { borderBottomColor: colors.borderLight, borderBottomWidth: i < (webhookResult || []).length - 1 ? 1 : 0 },
                          pressed && { backgroundColor: colors.surfaceHover },
                        ]}
                        onPress={() => setSelectedWebhook(w)}
                      >
                        <View style={styles.listItemHead}>
                          <Ionicons name={w.provider === 'razorpay' ? 'card' : 'chatbubble'} size={14} color={colors.text3} />
                          <Text style={[styles.listItemTitle, { color: colors.text }]} numberOfLines={1}>{w.event_type}</Text>
                          <View style={[styles.smallBadge, { backgroundColor: `${WEBHOOK_STATUS_COLORS[w.status]}15` }]}>
                            <View style={[styles.statusDotSm, { backgroundColor: WEBHOOK_STATUS_COLORS[w.status] }]} />
                            <Text style={[styles.smallBadgeText, { color: WEBHOOK_STATUS_COLORS[w.status] }]}>{w.status}</Text>
                          </View>
                        </View>
                        <View style={styles.listItemMeta}>
                          <Text style={[styles.listItemMetaText, { color: colors.text3 }]}>{w.provider}</Text>
                          {w.processing_time_ms && (
                            <>
                              <Text style={[styles.listItemMetaSep, { color: colors.text3 }]}>·</Text>
                              <Text style={[styles.listItemMetaText, { color: colors.text3 }]}>{w.processing_time_ms}ms</Text>
                            </>
                          )}
                          <Text style={[styles.listItemMetaSep, { color: colors.text3 }]}>·</Text>
                          <Text style={[styles.listItemMetaText, { color: colors.text3 }]}>
                            {new Date(w.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ SERVICES ═══════════ */}
        {section === 'services' && (
          <>
            {/* ── Run All Button ── */}
            <Pressable
              style={({ pressed }) => [styles.runAllBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
              onPress={handleRunAllChecks}
              disabled={checkingAll}
            >
              {checkingAll ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="pulse" size={18} color="#fff" />
                  <Text style={styles.runAllText}>Run All Health Checks</Text>
                </>
              )}
            </Pressable>

            {/* ── Status Grid ── */}
            {healthLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
            ) : (
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                {/* Summary badges */}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  {['up', 'degraded', 'down', 'unknown'].map((s) => {
                    const count = (healthData?.services || []).filter(svc => svc.status === s).length;
                    return (
                      <View key={s} style={[styles.countBadge, { backgroundColor: STATUS_BG[s] }]}>
                        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s] }]} />
                        <Text style={[styles.countBadgeText, { color: STATUS_COLORS[s] }]}>{count} {s}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Service cards */}
                {(healthData?.services || []).map((svc) => (
                  <View key={svc.id || svc.service_name} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.serviceCardHead}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.serviceNameRow}>
                          <Ionicons name={getServiceIcon(svc.service_name)} size={18} color={STATUS_COLORS[svc.status]} />
                          <Text style={[styles.serviceName, { color: colors.text }]}>{svc.service_name}</Text>
                          {getStatusBadge(svc.status)}
                        </View>
                        <View style={styles.serviceMeta}>
                          {svc.response_time_ms && (
                            <Text style={[styles.serviceMetaText, { color: colors.text3 }]}>
                              {svc.response_time_ms}ms
                            </Text>
                          )}
                          {svc.created_at && (
                            <Text style={[styles.serviceMetaText, { color: colors.text3 }]}>
                              Checked: {new Date(svc.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={({ pressed }) => [styles.checkBtn, { borderColor: colors.primary }, pressed && { opacity: 0.6 }]}
                        onPress={() => handleRunCheck(svc.service_name)}
                        disabled={checkingService === svc.service_name}
                      >
                        {checkingService === svc.service_name ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="refresh" size={14} color={colors.primary} />
                            <Text style={[styles.checkBtnText, { color: colors.primary }]}>Check</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    {svc.error_message && (
                      <Text style={[styles.serviceError, { color: colors.red }]}>{svc.error_message}</Text>
                    )}
                    {svc.endpoint_tested && (
                      <Text style={[styles.serviceEndpoint, { color: colors.text3 }]}>Endpoint: {svc.endpoint_tested}</Text>
                    )}
                  </View>
                ))}

                {/* ── Uptime Table ── */}
                <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Uptime (7 Days)</Text>
                <View style={[styles.tableCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {(healthData?.uptime || []).map((u, i) => (
                    <View
                      key={u.service_name}
                      style={[styles.tableRow, { borderBottomColor: colors.borderLight, borderBottomWidth: i < (healthData?.uptime || []).length - 1 ? 1 : 0 }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tableServiceName, { color: colors.text }]} numberOfLines={1}>{u.service_name}</Text>
                        <Text style={[styles.tableMeta, { color: colors.text3 }]}>
                          {u.up_count}/{u.total_checks} checks · {u.avg_response_ms}ms avg
                        </Text>
                      </View>
                      <Text style={[
                        styles.tablePercent,
                        { color: u.uptime_pct >= 99 ? colors.green : u.uptime_pct >= 95 ? colors.amber : colors.red }
                      ]}>
                        {u.uptime_pct}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ═══════════ INTEGRATIONS ═══════════ */}
        {section === 'config' && (
          <>
            {integrationsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
            ) : (integrations || []).length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="options-outline" size={40} color={colors.text3} />
                <Text style={[styles.emptyText, { color: colors.text3 }]}>No integrations configured</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                {(integrations || []).map((integ) => (
                  <View key={integ.id} style={[styles.integCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Pressable
                      style={styles.integHeader}
                      onPress={() => setExpandedConfig(expandedConfig === integ.service_name ? null : integ.service_name)}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.integNameRow}>
                          <Ionicons name={getServiceIcon(integ.service_name)} size={20} color={STATUS_COLORS[integ.current_status || 'unknown']} />
                          <Text style={[styles.integName, { color: colors.text }]}>{integ.display_name}</Text>
                          {integ.current_status && getStatusBadge(integ.current_status)}
                        </View>
                        <Text style={[styles.integServiceName, { color: colors.text3 }]}>{integ.service_name}</Text>
                      </View>
                      <View style={styles.integRight}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.toggleBtn,
                            { backgroundColor: integ.is_enabled ? colors.green : colors.text3 },
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => handleToggleIntegration(integ.service_name, integ.is_enabled)}
                        >
                          <View style={[
                            styles.toggleKnob,
                            integ.is_enabled ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' },
                          ]} />
                        </Pressable>
                        <Ionicons
                          name={expandedConfig === integ.service_name ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.text3}
                        />
                      </View>
                    </Pressable>

                    {expandedConfig === integ.service_name && (
                      <View style={[styles.integExpanded, { borderTopColor: colors.borderLight }]}>
                        {integ.base_url && (
                          <View style={styles.integField}>
                            <Text style={[styles.integFieldLabel, { color: colors.text3 }]}>Base URL</Text>
                            <Text style={[styles.integFieldValue, { color: colors.text }]} selectable>{integ.base_url}</Text>
                          </View>
                        )}
                        {integ.last_checked_at && (
                          <View style={styles.integField}>
                            <Text style={[styles.integFieldLabel, { color: colors.text3 }]}>Last Checked</Text>
                            <Text style={[styles.integFieldValue, { color: colors.text }]}>
                              {new Date(integ.last_checked_at).toLocaleString('en-IN')}
                            </Text>
                          </View>
                        )}
                        <View style={styles.integField}>
                          <Text style={[styles.integFieldLabel, { color: colors.text3 }]}>Config</Text>
                          <Text style={[styles.integFieldValue, { color: colors.text, fontSize: 11 }]}>
                            {JSON.stringify(integ.config, null, 1)}
                          </Text>
                        </View>
                        {integ.feature_flags && Object.keys(integ.feature_flags).length > 0 && (
                          <View style={styles.integField}>
                            <Text style={[styles.integFieldLabel, { color: colors.text3 }]}>Feature Flags</Text>
                            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm }}>
                              {Object.entries(integ.feature_flags).map(([flag, enabled]) => (
                                <View
                                  key={flag}
                                  style={[styles.flagChip, { backgroundColor: enabled ? '#0B6B4A15' : '#6B728015' }]}
                                >
                                  <Ionicons
                                    name={enabled ? 'checkmark-circle' : 'close-circle'}
                                    size={12}
                                    color={enabled ? '#0B6B4A' : '#6B7280'}
                                  />
                                  <Text style={[styles.flagChipText, { color: enabled ? '#0B6B4A' : '#6B7280' }]}>
                                    {flag.replace(/_/g, ' ')}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing.xl7 }} />
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
  scrollContent: { paddingBottom: spacing.xl5 },

  // ── Section Tabs ──
  tabRow: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.smd,
    borderBottomWidth: 1, gap: spacing.sm,
  },
  sectionTab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md,
    borderRadius: radii.full,
  },
  sectionTabLabel: { fontSize: 12, fontWeight: '600' },

  // ── API Keys ──
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  serviceFilter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterInputSm: { flex: 1, fontSize: 12, padding: 0 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.smd,
    borderRadius: radii.full,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Create Form ──
  createForm: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.md },
  createFormTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.lg },
  formRow: { flexDirection: 'row', marginBottom: spacing.md },
  fieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  formInput: {
    fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radii.xs, borderWidth: 1, width: '100%', marginBottom: spacing.md,
  },
  envRow: { flexDirection: 'row', gap: spacing.sm },
  envChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  envChipText: { fontSize: 11, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingVertical: spacing.xl, borderRadius: radii.sm, marginTop: spacing.lg,
  },
  createBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Revealed Key Banner ──
  revealBanner: {
    flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md,
    padding: spacing.xl + 2, borderRadius: radii.sm, borderWidth: 1, alignItems: 'flex-start',
  },
  revealTitle: { fontSize: 13, fontWeight: '700', marginBottom: spacing.xs },
  revealValue: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: spacing.xs },
  revealHint: { fontSize: 10, fontWeight: '500' },

  // ── Key Cards ──
  serviceGroup: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  serviceGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.xl + 2, paddingBottom: spacing.md,
  },
  serviceGroupTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  keyCount: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  keyCountText: { fontSize: 10, fontWeight: '700' },
  keyCard: { padding: spacing.xl + 2, borderTopWidth: 1 },
  keyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  keyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  keyLabel: { fontSize: 14, fontWeight: '600' },
  keyMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  keyMetaText: { fontSize: 10, fontWeight: '500' },
  keyMetaDot: { fontSize: 10 },
  keyActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { padding: spacing.sm },
  keyNotes: { fontSize: 11, marginTop: spacing.md, fontStyle: 'italic' },
  keyRotated: { fontSize: 10, marginTop: spacing.xs },

  // ── Webhooks ──
  summaryCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  summaryTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.lg },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '500', marginTop: spacing.ssm },
  providerBreakdown: { borderTopWidth: 1, marginTop: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  providerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  providerName: { fontSize: 12, fontWeight: '600' },
  providerStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  providerStat: { fontSize: 11, fontWeight: '600' },
  providerStatSep: { fontSize: 11 },

  filterRow: { marginHorizontal: spacing.lg, marginTop: spacing.md },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '600' },

  listCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden', marginTop: spacing.md },
  listItem: { padding: spacing.xl + 2 },
  listItemHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  listItemTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  listItemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listItemMetaText: { fontSize: 10, fontWeight: '500' },
  listItemMetaSep: { fontSize: 10 },

  // ── Webhook Detail ──
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  backLinkText: { fontSize: 13, fontWeight: '600' },
  detailCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.xl + 2 },
  detailTitle: { fontSize: 16, fontWeight: '700' },
  detailSubtitle: { fontSize: 12, marginTop: spacing.xs },
  webhookDetailGrid: { borderTopWidth: 1, padding: spacing.xl + 2, gap: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailField: { fontSize: 11, fontWeight: '600', width: 110 },
  detailValue: { fontSize: 12, fontWeight: '500', flex: 1, textAlign: 'right' },
  replayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.xl + 2, borderTopWidth: 1,
  },
  replayBtnText: { fontSize: 13, fontWeight: '700' },

  // ── Services ──
  runAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.lg,
    paddingVertical: spacing.xl, borderRadius: radii.sm,
  },
  runAllText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  countBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full },
  countBadgeText: { fontSize: 11, fontWeight: '700' },

  serviceCard: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  serviceCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  serviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  serviceName: { fontSize: 14, fontWeight: '700', flex: 1 },
  serviceMeta: { flexDirection: 'row', gap: spacing.md },
  serviceMetaText: { fontSize: 11, fontWeight: '500' },
  serviceError: { fontSize: 11, marginTop: spacing.sm, fontWeight: '500' },
  serviceEndpoint: { fontSize: 10, marginTop: spacing.xs },
  checkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radii.full, borderWidth: 1,
  },
  checkBtnText: { fontSize: 12, fontWeight: '700' },

  // ── Uptime Table ──
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.lg, paddingTop: spacing.xl3, paddingBottom: spacing.md },
  tableCard: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  tableServiceName: { fontSize: 13, fontWeight: '600' },
  tableMeta: { fontSize: 10, marginTop: spacing.xs },
  tablePercent: { fontSize: 16, fontWeight: '800', marginLeft: spacing.md },

  // ── Integrations ──
  integCard: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  integHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  integNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  integName: { fontSize: 14, fontWeight: '700', flex: 1 },
  integServiceName: { fontSize: 11, fontWeight: '500' },
  integRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleBtn: {
    width: 44, height: 24, borderRadius: 12,
    justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fff',
  },
  integExpanded: { borderTopWidth: 1, padding: spacing.xl + 2, gap: spacing.md },
  integField: {},
  integFieldLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  integFieldValue: { fontSize: 12, fontWeight: '500' },
  flagChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full },
  flagChipText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },

  // ── Status badges ──
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radii.full },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 10, fontWeight: '700' },
  smallBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.ssm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  statusDotSm: { width: 4, height: 4, borderRadius: 2 },
  smallBadgeText: { fontSize: 9, fontWeight: '700' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl5, padding: spacing.xl7, borderRadius: radii.sm, borderWidth: 1 },
  emptyText: { fontSize: 14, fontWeight: '600', marginTop: spacing.lg },
});
