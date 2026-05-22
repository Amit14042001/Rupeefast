/**
 * RupeeFast — Admin Investor Management Dashboard
 *
 * Three-mode screen:
 *   ── Overview: Portfolio summary metrics, KPI cards, AUM trend (compact)
 *   ── Investors: Searchable/filterable list with portfolio stats, tap for detail
 *   ── Allocation: Fund allocation requests with approve/reject/execute
 *
 * Layout:
 *   ┌─ Top Nav ─────────────────────────────────────────────────┐
 *   ├─ Segmented Control: [Overview | Investors | Allocation]   │
 *   ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
 *   │  Overview: KPI cards, AUM trend mini chart, top investors │
 *   │  Investors: Search bar | Filter chips | Sort dropdown    │
 *   │  Investor list with ROI badges | Tap for detail view     │
 *   │  Detail: Portfolio breakdown, investments, snapshots     │
 *   │  Allocation: Request list with type/amount/status badges │
 *   │  Approve/Reject/Execute action buttons                   │
 *   └──────────────────────────────────────────────────────────┘
 */

import React, { useState, useCallback } from 'react';
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

interface InvestorSummary {
  id: number;
  name: string | null;
  mobile: string;
  kyc_status: string;
  trust_score: number | null;
  joined_at: string;
  total_invested: number;
  total_returns: number;
  active_investments: number;
  total_investments: number;
  roi_pct: number;
  pending_requests: number;
  last_active_at: string;
}

interface PortfolioMetrics {
  total_investors: number;
  active_investors: number;
  total_invested: number;
  total_returns: number;
  avg_roi: number;
  pending_requests: number;
}

interface InvestorMetrics {
  total_investors: number;
  kyc_verified: number;
  funded_investors: number;
  unfunded_investors: number;
  investors_with_requests: number;
  avg_investment: number;
  total_aum: number;
  total_pending_requests: number;
  growth: { month: string; new_investors: number }[];
  topInvestors: { id: number; name: string; mobile: string; total_invested: number; roi_pct: number; last_active_at: string }[];
}

interface AllocationRequest {
  id: number;
  investor_id: number;
  type: 'deploy' | 'withdraw';
  amount: number;
  risk_bucket: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  reviewed_by: number | null;
  reviewed_at: string | null;
  notes: string | null;
  executed_at: string | null;
  created_at: string;
  investor_name: string | null;
  investor_mobile: string | null;
  reviewer_name: string | null;
}

interface InvestorDetail extends InvestorSummary {
  breakdown: { risk_bucket: string; investment_count: number; total_amount: number; total_returns: number; bucket_roi: number }[];
  investments: any[];
  activity: { id: number; action: string; details: any; created_at: string }[];
  allocationRequests: AllocationRequest[];
  snapshots: { snapshot_date: string; total_value: number }[];
}

// ── Fallback Data ──

const FALLBACK_METRICS: InvestorMetrics = {
  total_investors: 25, kyc_verified: 18, funded_investors: 15,
  unfunded_investors: 10, investors_with_requests: 3,
  avg_investment: 85000, total_aum: 1275000, total_pending_requests: 4,
  growth: [
    { month: '2024-10', new_investors: 3 },
    { month: '2024-11', new_investors: 5 },
    { month: '2024-12', new_investors: 2 },
    { month: '2025-01', new_investors: 6 },
    { month: '2025-02', new_investors: 4 },
    { month: '2025-03', new_investors: 5 },
  ],
  topInvestors: [
    { id: 1, name: 'Priya Sharma', mobile: '9876540011', total_invested: 350000, roi_pct: 14.2, last_active_at: '2025-03-15T10:00:00Z' },
    { id: 2, name: 'Meera Patel', mobile: '9876540012', total_invested: 250000, roi_pct: 12.8, last_active_at: '2025-03-14T09:00:00Z' },
    { id: 3, name: 'Arun Kumar', mobile: '9876540015', total_invested: 180000, roi_pct: 11.5, last_active_at: '2025-03-10T08:00:00Z' },
  ],
};

const FALLBACK_INVESTORS: InvestorSummary[] = [
  { id: 1, name: 'Priya Sharma', mobile: '9876540011', kyc_status: 'verified', trust_score: 85, joined_at: '2024-06-15T00:00:00Z', total_invested: 350000, total_returns: 49700, active_investments: 3, total_investments: 5, roi_pct: 14.2, pending_requests: 0, last_active_at: '2025-03-15T10:00:00Z' },
  { id: 2, name: 'Meera Patel', mobile: '9876540012', kyc_status: 'verified', trust_score: 78, joined_at: '2024-08-01T00:00:00Z', total_invested: 250000, total_returns: 32000, active_investments: 2, total_investments: 4, roi_pct: 12.8, pending_requests: 1, last_active_at: '2025-03-14T09:00:00Z' },
  { id: 3, name: 'Rahul Verma', mobile: '9876540013', kyc_status: 'verified', trust_score: 72, joined_at: '2024-09-10T00:00:00Z', total_invested: 150000, total_returns: 16500, active_investments: 2, total_investments: 2, roi_pct: 11.0, pending_requests: 0, last_active_at: '2025-03-12T14:00:00Z' },
  { id: 4, name: 'Anita Gupta', mobile: '9876540014', kyc_status: 'pending', trust_score: 55, joined_at: '2025-01-05T00:00:00Z', total_invested: 50000, total_returns: 2500, active_investments: 1, total_investments: 1, roi_pct: 5.0, pending_requests: 1, last_active_at: '2025-03-01T11:00:00Z' },
  { id: 5, name: 'Arun Kumar', mobile: '9876540015', kyc_status: 'verified', trust_score: 90, joined_at: '2024-04-20T00:00:00Z', total_invested: 180000, total_returns: 20700, active_investments: 3, total_investments: 6, roi_pct: 11.5, pending_requests: 0, last_active_at: '2025-03-10T08:00:00Z' },
  { id: 6, name: 'Suman Reddy', mobile: '9876540016', kyc_status: 'verified', trust_score: 68, joined_at: '2025-02-01T00:00:00Z', total_invested: 100000, total_returns: 6500, active_investments: 1, total_investments: 1, roi_pct: 6.5, pending_requests: 1, last_active_at: '2025-03-05T16:00:00Z' },
  { id: 7, name: 'Vikram Singh', mobile: '9876540017', kyc_status: 'verified', trust_score: 82, joined_at: '2024-07-15T00:00:00Z', total_invested: 95000, total_returns: 10450, active_investments: 2, total_investments: 3, roi_pct: 11.0, pending_requests: 0, last_active_at: '2025-03-09T12:00:00Z' },
  { id: 8, name: 'Deepa Nair', mobile: '9876540018', kyc_status: 'pending', trust_score: 45, joined_at: '2025-02-20T00:00:00Z', total_invested: 0, total_returns: 0, active_investments: 0, total_investments: 0, roi_pct: 0, pending_requests: 0, last_active_at: '2025-02-20T00:00:00Z' },
  { id: 9, name: 'Karan Joshi', mobile: '9876540019', kyc_status: 'verified', trust_score: 76, joined_at: '2025-01-15T00:00:00Z', total_invested: 75000, total_returns: 4125, active_investments: 1, total_investments: 2, roi_pct: 5.5, pending_requests: 0, last_active_at: '2025-03-08T10:00:00Z' },
  { id: 10, name: 'Neha Kapoor', mobile: '9876540020', kyc_status: 'verified', trust_score: 80, joined_at: '2024-10-01T00:00:00Z', total_invested: 125000, total_returns: 16250, active_investments: 2, total_investments: 3, roi_pct: 13.0, pending_requests: 1, last_active_at: '2025-03-13T15:00:00Z' },
];

const FALLBACK_ALLOCATIONS: AllocationRequest[] = [
  { id: 1, investor_id: 2, type: 'deploy', amount: 100000, risk_bucket: 'moderate', status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, executed_at: null, created_at: '2025-03-14T10:00:00Z', investor_name: 'Meera Patel', investor_mobile: '9876540012', reviewer_name: null },
  { id: 2, investor_id: 4, type: 'deploy', amount: 50000, risk_bucket: 'safe', status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, executed_at: null, created_at: '2025-03-12T09:00:00Z', investor_name: 'Anita Gupta', investor_mobile: '9876540014', reviewer_name: null },
  { id: 3, investor_id: 6, type: 'withdraw', amount: 25000, risk_bucket: null, status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, executed_at: null, created_at: '2025-03-10T14:00:00Z', investor_name: 'Suman Reddy', investor_mobile: '9876540016', reviewer_name: null },
  { id: 4, investor_id: 10, type: 'deploy', amount: 75000, risk_bucket: 'aggressive', status: 'pending', reviewed_by: null, reviewed_at: null, notes: null, executed_at: null, created_at: '2025-03-08T11:00:00Z', investor_name: 'Neha Kapoor', investor_mobile: '9876540020', reviewer_name: null },
  { id: 5, investor_id: 1, type: 'deploy', amount: 150000, risk_bucket: 'moderate', status: 'approved', reviewed_by: 1, reviewed_at: '2025-03-13T10:00:00Z', notes: 'Approved for moderate bucket', executed_at: null, created_at: '2025-03-12T08:00:00Z', investor_name: 'Priya Sharma', investor_mobile: '9876540011', reviewer_name: 'Admin User' },
  { id: 6, investor_id: 3, type: 'withdraw', amount: 50000, risk_bucket: null, status: 'executed', reviewed_by: 1, reviewed_at: '2025-03-10T09:00:00Z', notes: 'Withdrawal processed', executed_at: '2025-03-10T10:00:00Z', created_at: '2025-03-08T12:00:00Z', investor_name: 'Rahul Verma', investor_mobile: '9876540013', reviewer_name: 'Admin User' },
];

const FALLBACK_INVESTOR_DETAIL: InvestorDetail = {
  id: 1, name: 'Priya Sharma', mobile: '9876540011', kyc_status: 'verified', trust_score: 85, joined_at: '2024-06-15T00:00:00Z', total_invested: 350000, total_returns: 49700, active_investments: 3, total_investments: 5, roi_pct: 14.2, pending_requests: 0, last_active_at: '2025-03-15T10:00:00Z',
  breakdown: [
    { risk_bucket: 'safe', investment_count: 1, total_amount: 100000, total_returns: 8000, bucket_roi: 8.0 },
    { risk_bucket: 'moderate', investment_count: 1, total_amount: 150000, total_returns: 21700, bucket_roi: 14.5 },
    { risk_bucket: 'aggressive', investment_count: 1, total_amount: 100000, total_returns: 20000, bucket_roi: 20.0 },
  ],
  investments: [],
  activity: [
    { id: 1, action: 'investment.created', details: { amount: 100000, bucket: 'safe' }, created_at: '2025-03-15T10:00:00Z' },
    { id: 2, action: 'allocation.approved', details: { amount: 150000, type: 'deploy' }, created_at: '2025-03-13T10:00:00Z' },
    { id: 3, action: 'withdrawal.completed', details: { amount: 25000 }, created_at: '2025-03-01T08:00:00Z' },
  ],
  allocationRequests: [FALLBACK_ALLOCATIONS[4]],
  snapshots: [
    { snapshot_date: '2025-02-15', total_value: 330000 },
    { snapshot_date: '2025-02-22', total_value: 338000 },
    { snapshot_date: '2025-03-01', total_value: 345000 },
    { snapshot_date: '2025-03-08', total_value: 358000 },
    { snapshot_date: '2025-03-15', total_value: 399700 },
  ],
};

// ── Helpers ──

const KYC_COLORS: Record<string, string> = {
  verified: '#0B6B4A', pending: '#9A6200', rejected: '#A02020', not_submitted: '#6B7280',
};

const REQUEST_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  deploy: { color: '#0B6B4A', bg: '#E8F5E9' },
  withdraw: { color: '#A02020', bg: '#FFEBEE' },
};

const REQUEST_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: '#9A6200', bg: '#FFF8E1' },
  approved: { color: '#2562A8', bg: '#E3F2FD' },
  rejected: { color: '#A02020', bg: '#FFEBEE' },
  executed: { color: '#0B6B4A', bg: '#E8F5E9' },
  cancelled: { color: '#6B7280', bg: '#F3F4F6' },
};

function formatCurrency(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return dateStr; }
}

function daysAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  } catch { return ''; }
}

// ══════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════

export default function AdminInvestorsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();

  // ── Mode ──
  const [mode, setMode] = useState<'overview' | 'investors' | 'allocation'>('overview');

  // ── Investor list state ──
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [sortBy, setSortBy] = useState('total_invested');
  const [selectedInvestorId, setSelectedInvestorId] = useState<number | null>(null);

  // ── Allocation state ──
  const [allocationStatusFilter, setAllocationStatusFilter] = useState('');

  // ── Data fetching ──
  const metricsFetcher = useCallback(async () => {
    const result = await apiFetch<{ summary: PortfolioMetrics; metrics: InvestorMetrics }>(ENDPOINTS.INVESTORS_SUMMARY);
    if (result.success && result.data) return result.data.metrics;
    return null;
  }, []);

  const investorsFetcher = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (kycFilter) params.set('kyc_status', kycFilter);
    params.set('sort_by', sortBy);
    const result = await apiFetch<{ investors: InvestorSummary[]; total: number }>(`${ENDPOINTS.INVESTORS}?${params.toString()}`);
    if (result.success && result.data) return result.data.investors;
    return null;
  }, [search, kycFilter, sortBy]);

  const allocationsFetcher = useCallback(async () => {
    const params = new URLSearchParams();
    if (allocationStatusFilter) params.set('status', allocationStatusFilter);
    const result = await apiFetch<{ requests: AllocationRequest[] }>(`${ENDPOINTS.ALLOCATION_REQUESTS}?${params.toString()}`);
    if (result.success && result.data) return result.data.requests;
    return null;
  }, [allocationStatusFilter]);

  const investorDetailFetcher = useCallback(async () => {
    if (!selectedInvestorId) return null;
    const result = await apiFetch<{ investor: InvestorDetail }>(ENDPOINTS.INVESTOR_DETAIL(selectedInvestorId));
    if (result.success && result.data) return result.data.investor;
    return null;
  }, [selectedInvestorId]);

  const { data: metrics, loading: metricsLoading } = useTimedAsyncData(metricsFetcher, FALLBACK_METRICS, 5000);
  const { data: investors, loading: investorsLoading } = useTimedAsyncData(investorsFetcher, FALLBACK_INVESTORS, 5000);
  const { data: allocations, loading: allocationsLoading } = useTimedAsyncData(allocationsFetcher, FALLBACK_ALLOCATIONS, 5000);
  const { data: selectedInvestor, loading: detailLoading } = useTimedAsyncData(investorDetailFetcher, FALLBACK_INVESTOR_DETAIL, 5000);

  // ── Filter investors ──
  const filteredInvestors = (investors || []).filter((inv) => {
    if (search) {
      const q = search.toLowerCase();
      if (!inv.name?.toLowerCase().includes(q) && !inv.mobile.includes(q)) return false;
    }
    if (kycFilter && inv.kyc_status !== kycFilter) return false;
    return true;
  });

  // ── Actions ──
  const handleApproveAllocation = useCallback(async (id: number) => {
    const result = await apiFetch(ENDPOINTS.ALLOCATION_APPROVE(id), { method: 'POST' });
    if (result.success) {
      Alert.alert('Approved', 'Allocation request approved.');
    } else {
      Alert.alert('Error', result.error || 'Failed to approve');
    }
  }, []);

  const handleRejectAllocation = useCallback(async (id: number) => {
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        const result = await apiFetch(ENDPOINTS.ALLOCATION_REJECT(id), {
          method: 'POST',
          body: { reason: 'Rejected by admin' },
        });
        if (result.success) {
          Alert.alert('Rejected', 'Allocation request rejected.');
        } else {
          Alert.alert('Error', result.error || 'Failed to reject');
        }
      }},
    ]);
  }, []);

  const handleExecuteAllocation = useCallback(async (id: number) => {
    const result = await apiFetch(ENDPOINTS.ALLOCATION_EXECUTE(id), { method: 'POST' });
    if (result.success) {
      Alert.alert('Executed', 'Allocation request executed.');
    } else {
      Alert.alert('Error', result.error || 'Failed to execute');
    }
  }, []);

  // ── Render AUM trend mini chart (text-based) ──
  const renderMiniTrend = useCallback(() => {
    if (!selectedInvestor?.snapshots || selectedInvestor.snapshots.length < 2) return null;
    const vals = selectedInvestor.snapshots.map(s => s.total_value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;

    return (
      <View style={[styles.trendContainer, { backgroundColor: colors.bg }]}>
        {selectedInvestor.snapshots.map((s, i) => {
          const pct = ((s.total_value - min) / range) * 100;
          return (
            <View key={i} style={styles.trendBar}>
              <View style={[styles.trendBarFill, { height: `${pct}%`, backgroundColor: colors.primary, opacity: 0.6 + (pct / 100) * 0.4 }]} />
            </View>
          );
        })}
      </View>
    );
  }, [selectedInvestor, colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Ionicons name="briefcase" size={20} color={colors.primary} />
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Investors</Text>
      </View>

      {/* ── Segmented Control ── */}
      <View style={[styles.segmentRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable
          style={[styles.segmentBtn, mode === 'overview' && { backgroundColor: colors.primary }]}
          onPress={() => { setMode('overview'); setSelectedInvestorId(null); }}
        >
          <Ionicons name="stats-chart" size={16} color={mode === 'overview' ? '#fff' : colors.text3} />
          <Text style={[styles.segmentLabel, { color: mode === 'overview' ? '#fff' : colors.text3 }]}>Overview</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, mode === 'investors' && { backgroundColor: colors.primary }]}
          onPress={() => { setMode('investors'); setSelectedInvestorId(null); }}
        >
          <Ionicons name="people" size={16} color={mode === 'investors' ? '#fff' : colors.text3} />
          <Text style={[styles.segmentLabel, { color: mode === 'investors' ? '#fff' : colors.text3 }]}>Investors</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, mode === 'allocation' && { backgroundColor: colors.primary }]}
          onPress={() => { setMode('allocation'); setSelectedInvestorId(null); }}
        >
          <Ionicons name="swap-horizontal" size={16} color={mode === 'allocation' ? '#fff' : colors.text3} />
          <Text style={[styles.segmentLabel, { color: mode === 'allocation' ? '#fff' : colors.text3 }]}>Allocation</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ═══════════ OVERVIEW MODE ═══════════ */}
        {mode === 'overview' && (
          <>
            {metricsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
            ) : (
              <>
                {/* ── KPI Row ── */}
                <View style={styles.kpiRow}>
                  <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.kpiValue, { color: colors.primary }]}>{metrics?.total_investors || 0}</Text>
                    <Text style={[styles.kpiLabel, { color: colors.text3 }]}>Total Investors</Text>
                  </View>
                  <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.kpiValue, { color: colors.green }]}>{metrics?.funded_investors || 0}</Text>
                    <Text style={[styles.kpiLabel, { color: colors.text3 }]}>Funded</Text>
                  </View>
                  <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.kpiValue, { color: colors.amber }]}>{metrics?.unfunded_investors || 0}</Text>
                    <Text style={[styles.kpiLabel, { color: colors.text3 }]}>Unfunded</Text>
                  </View>
                </View>

                {/* ── AUM & ROI ── */}
                <View style={styles.kpiRow}>
                  <View style={[styles.kpiCardWide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.kpiLabel, { color: colors.text3 }]}>AUM</Text>
                    <Text style={[styles.kpiValueLarge, { color: colors.primary }]}>{formatCurrency(metrics?.total_aum || 0)}</Text>
                  </View>
                  <View style={[styles.kpiCardWide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.kpiLabel, { color: colors.text3 }]}>Avg Investment</Text>
                    <Text style={[styles.kpiValueLarge, { color: colors.text }]}>{formatCurrency(metrics?.avg_investment || 0)}</Text>
                  </View>
                </View>

                {/* ── KYC & Requests Stats ── */}
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Ionicons name="shield-checkmark" size={16} color={KYC_COLORS.verified} />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{metrics?.kyc_verified || 0}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.text3 }]}>KYC Verified</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="time" size={16} color={REQUEST_STATUS_COLORS.pending.color} />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{metrics?.total_pending_requests || 0}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.text3 }]}>Pending Req.</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Ionicons name="people" size={16} color={colors.primary} />
                      <Text style={[styles.summaryValue, { color: colors.text }]}>{metrics?.investors_with_requests || 0}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.text3 }]}>With Requests</Text>
                    </View>
                  </View>
                </View>

                {/* ── Growth Chart (text-based bars) ── */}
                {metrics?.growth && metrics.growth.length > 0 && (
                  <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.chartTitle, { color: colors.text2 }]}>New Investors (Monthly)</Text>
                    <View style={styles.chartRow}>
                      {metrics.growth.map((g, i) => {
                        const maxCount = Math.max(...metrics.growth.map((x: any) => x.new_investors), 1);
                        const heightPct = (g.new_investors / maxCount) * 100;
                        return (
                          <View key={i} style={styles.chartBarCol}>
                            <View style={[styles.chartBar, { height: `${heightPct}%`, backgroundColor: colors.primary }]} />
                            <Text style={[styles.chartLabel, { color: colors.text3 }]}>{g.new_investors}</Text>
                            <Text style={[styles.chartMonth, { color: colors.text3 }]}>{g.month.slice(-2)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* ── Top Investors ── */}
                <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Top Investors by AUM</Text>
                {metrics?.topInvestors && metrics.topInvestors.length > 0 ? (
                  <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {metrics.topInvestors.map((inv, i) => (
                      <Pressable
                        key={inv.id}
                        style={({ pressed }) => [
                          styles.investorRow,
                          { borderBottomColor: colors.borderLight },
                          i === metrics.topInvestors.length - 1 && { borderBottomWidth: 0 },
                          pressed && { backgroundColor: colors.surfaceHover },
                        ]}
                        onPress={() => { setSelectedInvestorId(inv.id); setMode('investors'); }}
                      >
                        <View style={[styles.rankBadge, { backgroundColor: i < 3 ? colors.primary : colors.bg }]}>
                          <Text style={[styles.rankText, { color: i < 3 ? '#fff' : colors.text3 }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.investorName, { color: colors.text }]}>{inv.name || 'Unnamed'}</Text>
                          <Text style={[styles.investorMobile, { color: colors.text3 }]}>{inv.mobile}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.investorAmount, { color: colors.text }]}>{formatCurrency(inv.total_invested)}</Text>
                          <View style={[styles.roiBadge, { backgroundColor: inv.roi_pct >= 10 ? '#E8F5E9' : '#FFF8E1' }]}>
                            <Text style={[styles.roiText, { color: inv.roi_pct >= 10 ? '#0B6B4A' : '#9A6200' }]}>{inv.roi_pct}%</Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="people-outline" size={40} color={colors.text3} />
                    <Text style={[styles.emptyText, { color: colors.text3 }]}>No investors yet</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ INVESTORS MODE ═══════════ */}
        {mode === 'investors' && (
          <>
            {/* ── Investor Detail View ── */}
            {selectedInvestorId && selectedInvestor ? (
              <View>
                <Pressable
                  style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedInvestorId(null)}
                >
                  <Ionicons name="arrow-back" size={18} color={colors.primary} />
                  <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to Investors</Text>
                </Pressable>

                {detailLoading ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
                ) : (
                  <>
                    {/* ── Investor Header ── */}
                    <View style={[styles.detailHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.detailAvatar}>
                        <Text style={styles.detailAvatarText}>
                          {(selectedInvestor.name || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailName, { color: colors.text }]}>{selectedInvestor.name || 'Unnamed Investor'}</Text>
                        <Text style={[styles.detailMobile, { color: colors.text3 }]}>{selectedInvestor.mobile}</Text>
                        <View style={styles.detailBadgeRow}>
                          <View style={[styles.kycBadge, { backgroundColor: `${KYC_COLORS[selectedInvestor.kyc_status] || colors.text3}15` }]}>
                            <View style={[styles.kycDot, { backgroundColor: KYC_COLORS[selectedInvestor.kyc_status] || colors.text3 }]} />
                            <Text style={[styles.kycText, { color: KYC_COLORS[selectedInvestor.kyc_status] || colors.text3 }]}>
                              {selectedInvestor.kyc_status}
                            </Text>
                          </View>
                          <Text style={[styles.detailMeta, { color: colors.text3 }]}>Joined {formatDate(selectedInvestor.joined_at)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* ── Portfolio Stats ── */}
                    <View style={[styles.detailStats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={styles.detailStatItem}>
                        <Text style={[styles.detailStatValue, { color: colors.primary }]}>{formatCurrency(selectedInvestor.total_invested)}</Text>
                        <Text style={[styles.detailStatLabel, { color: colors.text3 }]}>Invested</Text>
                      </View>
                      <View style={styles.detailStatItem}>
                        <Text style={[styles.detailStatValue, { color: colors.green }]}>{formatCurrency(selectedInvestor.total_returns)}</Text>
                        <Text style={[styles.detailStatLabel, { color: colors.text3 }]}>Returns</Text>
                      </View>
                      <View style={styles.detailStatItem}>
                        <Text style={[styles.detailStatValue, { color: selectedInvestor.roi_pct >= 10 ? colors.green : colors.amber }]}>{selectedInvestor.roi_pct}%</Text>
                        <Text style={[styles.detailStatLabel, { color: colors.text3 }]}>ROI</Text>
                      </View>
                      <View style={styles.detailStatItem}>
                        <Text style={[styles.detailStatValue, { color: colors.text }]}>{selectedInvestor.active_investments}</Text>
                        <Text style={[styles.detailStatLabel, { color: colors.text3 }]}>Active</Text>
                      </View>
                    </View>

                    {/* ── Portfolio Breakdown ── */}
                    {selectedInvestor.breakdown && selectedInvestor.breakdown.length > 0 && (
                      <>
                        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Portfolio Breakdown</Text>
                        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {selectedInvestor.breakdown.map((b, i) => (
                            <View
                              key={b.risk_bucket}
                              style={[styles.breakdownRow, { borderBottomColor: colors.borderLight }, i === selectedInvestor.breakdown.length - 1 && { borderBottomWidth: 0 }]}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                                <View style={[styles.bucketDot, {
                                  backgroundColor: b.risk_bucket === 'safe' ? '#0B6B4A' : b.risk_bucket === 'moderate' ? '#2562A8' : '#9A6200'
                                }]} />
                                <View>
                                  <Text style={[styles.bucketLabel, { color: colors.text }]}>{b.risk_bucket}</Text>
                                  <Text style={[styles.bucketCount, { color: colors.text3 }]}>{b.investment_count} investment{b.investment_count !== 1 ? 's' : ''}</Text>
                                </View>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.investorAmount, { color: colors.text }]}>{formatCurrency(b.total_amount)}</Text>
                                <Text style={[styles.roiText, { color: b.bucket_roi >= 10 ? '#0B6B4A' : '#9A6200' }]}>{b.bucket_roi}% ROI</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </>
                    )}

                    {/* ── Portfolio Value Trend ── */}
                    {selectedInvestor.snapshots && selectedInvestor.snapshots.length >= 2 && (
                      <>
                        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Portfolio Value (30d)</Text>
                        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.xl + 2 }]}>
                          {renderMiniTrend()}
                          <View style={styles.trendLabels}>
                            <Text style={[styles.trendLabelText, { color: colors.text3 }]}>{formatDate(selectedInvestor.snapshots[0].snapshot_date)}</Text>
                            <Text style={[styles.trendLabelText, { color: colors.text3 }]}>{formatDate(selectedInvestor.snapshots[selectedInvestor.snapshots.length - 1].snapshot_date)}</Text>
                          </View>
                          <View style={[styles.trendChange, { backgroundColor: colors.bg }]}>
                            <Ionicons
                              name={selectedInvestor.snapshots[selectedInvestor.snapshots.length - 1].total_value >= selectedInvestor.snapshots[0].total_value ? 'trending-up' : 'trending-down'}
                              size={14}
                              color={selectedInvestor.snapshots[selectedInvestor.snapshots.length - 1].total_value >= selectedInvestor.snapshots[0].total_value ? colors.green : colors.red}
                            />
                            <Text style={[styles.trendChangeText, { color: colors.text2 }]}>
                              {formatCurrency(selectedInvestor.snapshots[selectedInvestor.snapshots.length - 1].total_value)}
                            </Text>
                            <Text style={[styles.trendChangePct, { color: colors.text3 }]}>
                              {((selectedInvestor.snapshots[selectedInvestor.snapshots.length - 1].total_value - selectedInvestor.snapshots[0].total_value) / selectedInvestor.snapshots[0].total_value * 100).toFixed(1)}%
                            </Text>
                          </View>
                        </View>
                      </>
                    )}

                    {/* ── Recent Activity ── */}
                    {selectedInvestor.activity && selectedInvestor.activity.length > 0 && (
                      <>
                        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>Recent Activity</Text>
                        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {selectedInvestor.activity.slice(0, 5).map((a, i) => (
                            <View
                              key={a.id}
                              style={[styles.activityRow, { borderBottomColor: colors.borderLight }, i === Math.min(selectedInvestor.activity.length, 5) - 1 && { borderBottomWidth: 0 }]}
                            >
                              <View style={[styles.activityDot, { backgroundColor: a.action.includes('approved') || a.action.includes('executed') ? colors.green : colors.primary }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.activityAction, { color: colors.text }]}>{a.action.replace(/\./g, ' ')}</Text>
                                <Text style={[styles.activityMeta, { color: colors.text3 }]}>{daysAgo(a.created_at)}</Text>
                              </View>
                              {a.details?.amount && (
                                <Text style={[styles.activityAmount, { color: colors.text2 }]}>{formatCurrency(Number(a.details.amount))}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
            ) : (
              <>
                {/* ── Search Bar ── */}
                <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={16} color={colors.text3} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search by name or mobile..."
                    placeholderTextColor={colors.text3}
                    value={search}
                    onChangeText={setSearch}
                  />
                </View>

                {/* ── Filter & Sort Row ── */}
                <View style={styles.filterRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChipRow}>
                      {['', 'verified', 'pending', 'rejected'].map((s) => (
                        <Pressable
                          key={s || 'all'}
                          style={({ pressed }) => [
                            styles.filterChip,
                            { backgroundColor: kycFilter === s ? colors.primary : colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => setKycFilter(s)}
                        >
                          <Text style={[styles.filterChipText, { color: kycFilter === s ? '#fff' : colors.text }]}>
                            {s || 'All KYC'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.filterRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChipRow}>
                      {['total_invested', 'roi_pct', 'joined_at', 'last_active_at'].map((s) => (
                        <Pressable
                          key={s}
                          style={({ pressed }) => [
                            styles.filterChip,
                            { backgroundColor: sortBy === s ? colors.primary : colors.surface, borderColor: colors.border },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => setSortBy(s)}
                        >
                          <Text style={[styles.filterChipText, { color: sortBy === s ? '#fff' : colors.text }]}>
                            {s === 'total_invested' ? 'By AUM' : s === 'roi_pct' ? 'By ROI' : s === 'joined_at' ? 'Newest' : 'Last Active'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* ── Investor List ── */}
                {investorsLoading ? (
                  <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
                ) : filteredInvestors.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="people-outline" size={40} color={colors.text3} />
                    <Text style={[styles.emptyText, { color: colors.text3 }]}>No investors found</Text>
                  </View>
                ) : (
                  <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {filteredInvestors.map((inv, i) => (
                      <Pressable
                        key={inv.id}
                        style={({ pressed }) => [
                          styles.investorRow,
                          { borderBottomColor: colors.borderLight },
                          i === filteredInvestors.length - 1 && { borderBottomWidth: 0 },
                          pressed && { backgroundColor: colors.surfaceHover },
                        ]}
                        onPress={() => setSelectedInvestorId(inv.id)}
                      >
                        <View style={[styles.avThumb, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.avThumbText, { color: colors.primary }]}>
                            {(inv.name || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.investorHead}>
                            <Text style={[styles.investorName, { color: colors.text }]} numberOfLines={1}>{inv.name || 'Unnamed'}</Text>
                            <View style={[styles.kycBadge, { backgroundColor: `${KYC_COLORS[inv.kyc_status] || colors.text3}15` }]}>
                              <View style={[styles.kycDot, { backgroundColor: KYC_COLORS[inv.kyc_status] || colors.text3 }]} />
                            </View>
                          </View>
                          <View style={styles.investorMeta}>
                            <Text style={[styles.investorMobile, { color: colors.text3 }]}>{inv.mobile}</Text>
                            <Text style={[styles.investorAmount, { color: colors.text2 }]}>{formatCurrency(inv.total_invested)}</Text>
                            <View style={[styles.roiBadge, { backgroundColor: inv.roi_pct >= 10 ? '#E8F5E9' : '#FFF8E1' }]}>
                              <Text style={[styles.roiText, { color: inv.roi_pct >= 10 ? '#0B6B4A' : '#9A6200' }]}>{inv.roi_pct}%</Text>
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

        {/* ═══════════ ALLOCATION MODE ═══════════ */}
        {mode === 'allocation' && (
          <>
            {/* ── Status Filter ── */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterChipRow}>
                  {['', 'pending', 'approved', 'rejected', 'executed', 'cancelled'].map((s) => (
                    <Pressable
                      key={s || 'all'}
                      style={({ pressed }) => [
                        styles.filterChip,
                        { backgroundColor: allocationStatusFilter === s ? colors.primary : colors.surface, borderColor: colors.border },
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={() => setAllocationStatusFilter(s)}
                    >
                      <Text style={[styles.filterChipText, { color: allocationStatusFilter === s ? '#fff' : colors.text }]}>
                        {s || 'All'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {allocationsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 }} />
            ) : !allocations || allocations.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="swap-horizontal-outline" size={40} color={colors.text3} />
                <Text style={[styles.emptyText, { color: colors.text3 }]}>No allocation requests</Text>
              </View>
            ) : (
              <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {allocations.map((req, i) => {
                  const typeStyle = REQUEST_TYPE_COLORS[req.type] || { color: colors.text3, bg: colors.bg };
                  const statusStyle = REQUEST_STATUS_COLORS[req.status] || { color: colors.text3, bg: colors.bg };
                  return (
                    <View
                      key={req.id}
                      style={[styles.allocationItem, { borderBottomColor: colors.borderLight }, i === allocations.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      {/* Header row */}
                      <View style={styles.allocationHead}>
                        <View style={[styles.allocationType, { backgroundColor: typeStyle.bg }]}>
                          <Ionicons
                            name={req.type === 'deploy' ? 'add-circle' : 'remove-circle'}
                            size={14}
                            color={typeStyle.color}
                          />
                          <Text style={[styles.allocationTypeText, { color: typeStyle.color }]}>{req.type}</Text>
                        </View>
                        <View style={[styles.allocationStatus, { backgroundColor: statusStyle.bg }]}>
                          <Text style={[styles.allocationStatusText, { color: statusStyle.color }]}>{req.status}</Text>
                        </View>
                      </View>

                      {/* Investor info */}
                      <Text style={[styles.allocationInvestor, { color: colors.text }]}>{req.investor_name || `Investor #${req.investor_id}`}</Text>

                      {/* Amount & bucket */}
                      <View style={styles.allocationMeta}>
                        <Text style={[styles.allocationAmount, { color: colors.text }]}>{formatCurrency(req.amount)}</Text>
                        {req.risk_bucket && (
                          <View style={[styles.allocationBucket, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.allocationBucketText, { color: colors.text2 }]}>{req.risk_bucket}</Text>
                          </View>
                        )}
                      </View>

                      {/* Date & reviewer */}
                      <View style={styles.allocationFooter}>
                        <Text style={[styles.allocationDate, { color: colors.text3 }]}>
                          {formatDate(req.created_at)} — {daysAgo(req.created_at)}
                        </Text>
                        {req.status === 'approved' && req.reviewer_name && (
                          <Text style={[styles.allocationReviewer, { color: colors.text3 }]}>
                            by {req.reviewer_name}
                          </Text>
                        )}
                      </View>

                      {/* Action buttons (only for pending requests) */}
                      {req.status === 'pending' && (
                        <View style={styles.allocationActions}>
                          <Pressable
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#E8F5E9' }, pressed && { opacity: 0.8 }]}
                            onPress={() => handleApproveAllocation(req.id)}
                          >
                            <Ionicons name="checkmark" size={14} color="#0B6B4A" />
                            <Text style={[styles.actionBtnText, { color: '#0B6B4A' }]}>Approve</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#FFEBEE' }, pressed && { opacity: 0.8 }]}
                            onPress={() => handleRejectAllocation(req.id)}
                          >
                            <Ionicons name="close" size={14} color="#A02020" />
                            <Text style={[styles.actionBtnText, { color: '#A02020' }]}>Reject</Text>
                          </Pressable>
                        </View>
                      )}

                      {/* Execute button (for approved but not executed) */}
                      {req.status === 'approved' && (
                        <View style={styles.allocationActions}>
                          <Pressable
                            style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#E3F2FD' }, pressed && { opacity: 0.8 }]}
                            onPress={() => handleExecuteAllocation(req.id)}
                          >
                            <Ionicons name="play" size={14} color="#2562A8" />
                            <Text style={[styles.actionBtnText, { color: '#2562A8' }]}>Execute</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
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
  segmentLabel: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl5 },

  // ── Sections ──
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingTop: spacing.xl3, paddingBottom: spacing.md },

  // ── KPI Cards ──
  kpiRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.lg },
  kpiCard: { flex: 1, alignItems: 'center', padding: spacing.xl + 2, borderRadius: radii.sm, borderWidth: 1 },
  kpiCardWide: { flex: 1, padding: spacing.xl + 2, borderRadius: radii.sm, borderWidth: 1 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginBottom: spacing.xs },
  kpiValueLarge: { fontSize: 18, fontWeight: '800', marginTop: spacing.xs },
  kpiLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },

  // ── Summary Card ──
  summaryCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', gap: spacing.xs },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  summaryLabel: { fontSize: 9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },

  // ── Chart ──
  chartCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  chartTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.lg },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 100 },
  chartBarCol: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  chartBar: { width: 20, borderRadius: radii.xs, minHeight: 4 },
  chartLabel: { fontSize: 10, fontWeight: '700' },
  chartMonth: { fontSize: 8, fontWeight: '500' },

  // ── Search & Filters ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginHorizontal: spacing.lg, marginTop: spacing.lg,
    paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md,
    borderRadius: radii.sm, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13 },
  filterRow: { marginHorizontal: spacing.lg, marginTop: spacing.smd, marginBottom: spacing.sm },
  filterChipRow: { flexDirection: 'row', gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2,
    borderRadius: radii.full, borderWidth: 1,
  },
  filterChipText: { fontSize: 11, fontWeight: '600' },

  // ── List Card ──
  listCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },

  // ── Investor Row ──
  investorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.xl + 2, borderBottomWidth: 1,
  },
  avThumb: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avThumbText: { fontSize: 14, fontWeight: '700' },
  investorHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  investorName: { fontSize: 14, fontWeight: '700', flex: 1 },
  investorMobile: { fontSize: 11, fontWeight: '500' },
  investorMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  investorAmount: { fontSize: 13, fontWeight: '700' },
  roiBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radii.full },
  roiText: { fontSize: 10, fontWeight: '800' },

  // ── KYC Badge ──
  kycBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 1, borderRadius: radii.full },
  kycDot: { width: 5, height: 5, borderRadius: 2.5 },
  kycText: { fontSize: 9, fontWeight: '700', marginLeft: spacing.ssm },

  // ── Rank Badge ──
  rankBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '800' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl5, padding: spacing.xl7, borderRadius: radii.sm, borderWidth: 1 },
  emptyText: { fontSize: 14, fontWeight: '600', marginTop: spacing.lg },

  // ── Back Link ──
  backLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md },
  backLinkText: { fontSize: 13, fontWeight: '600' },

  // ── Detail ──
  detailHeader: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, flexDirection: 'row', gap: spacing.xl + 2 },
  detailAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#5A3E9B', alignItems: 'center', justifyContent: 'center' },
  detailAvatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  detailName: { fontSize: 16, fontWeight: '700' },
  detailMobile: { fontSize: 12, fontWeight: '500', marginTop: spacing.xs },
  detailBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  detailMeta: { fontSize: 10, fontWeight: '500' },

  detailStats: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: radii.sm, borderWidth: 1, flexDirection: 'row', padding: spacing.xl + 2 },
  detailStatItem: { flex: 1, alignItems: 'center' },
  detailStatValue: { fontSize: 16, fontWeight: '800' },
  detailStatLabel: { fontSize: 9, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: spacing.xs },

  // ── Breakdown ──
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl + 2, borderBottomWidth: 1 },
  bucketDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.md },
  bucketLabel: { fontSize: 13, fontWeight: '600' },
  bucketCount: { fontSize: 10, fontWeight: '500', marginTop: spacing.xs },

  // ── Activity ──
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.xl + 2, borderBottomWidth: 1 },
  activityDot: { width: 6, height: 6, borderRadius: 3 },
  activityAction: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  activityMeta: { fontSize: 10, fontWeight: '500', marginTop: spacing.xs },
  activityAmount: { fontSize: 13, fontWeight: '700' },

  // ── Trend ──
  trendContainer: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: spacing.xs + 1, paddingVertical: spacing.md },
  trendBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  trendBarFill: { width: '100%', borderRadius: radii.xs, minHeight: 4 },
  trendLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  trendLabelText: { fontSize: 9, fontWeight: '500' },
  trendChange: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.smd, borderRadius: radii.full, alignSelf: 'flex-start' },
  trendChangeText: { fontSize: 12, fontWeight: '700' },
  trendChangePct: { fontSize: 11, fontWeight: '600' },

  // ── Allocation ──
  allocationItem: { padding: spacing.xl + 2, borderBottomWidth: 1 },
  allocationHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  allocationType: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full },
  allocationTypeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  allocationStatus: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full },
  allocationStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  allocationInvestor: { fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  allocationMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  allocationAmount: { fontSize: 16, fontWeight: '800' },
  allocationBucket: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  allocationBucketText: { fontSize: 10, fontWeight: '600' },
  allocationFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  allocationDate: { fontSize: 10, fontWeight: '500' },
  allocationReviewer: { fontSize: 10, fontWeight: '500' },
  allocationActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.md, borderRadius: radii.full },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
});
