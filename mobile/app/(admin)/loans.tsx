/**
 * RupeeFast — Admin Loan Management (v2)
 *
 * Enhanced multi-step loan approval workflow:
 *   Step 1: Credit Check   — bureau report, repayment history, credit category
 *   Step 2: Risk Assessment — multi-factor risk scoring with recommendations
 *   Step 3: Document Validation — verify/reject borrower documents
 *   Step 4: Final Approval  — tiered approval limits based on admin seniority
 *
 * Layout:
 *   ┌─ Top Nav ───────────────────────────────────────┐
 *   ├─ Filter tabs ───────────────────────────────────┤
 *   ├─ Loan cards with review step badges ────────────┤
 *   ├─ OR Tap loan → Detail with step progress ───────┤
 *   └─ Step content + actions ────────────────────────┘
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { ENDPOINTS } from '../../src/api/endpoints';


// ── Types ──

type LoanStatus =
  | 'applied' | 'credit_check' | 'risk_assessment' | 'document_validation'
  | 'approved' | 'rejected' | 'disbursed' | 'active' | 'overdue' | 'completed' | 'defaulted';

type FilterTab = 'all' | 'review' | 'active' | 'overdue' | 'completed';

type ReviewStep = 'credit_check' | 'risk_assessment' | 'document_validation' | 'final_approval';

interface LoanItem {
  id: number;
  borrower_name: string;
  borrower_mobile: string;
  amount: number;
  repayment_plan: string;
  status: LoanStatus;
  trust_score: number;
  credit_score: number;
  current_review_step: string;
  review_steps_passed: number;
  total_review_steps: number;
  created_at: string;
  disbursed_at: string | null;
}

interface ReviewStepData {
  id: number;
  loan_id: number;
  step: ReviewStep;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
  reviewer_id: number | null;
  notes: string | null;
  metadata: any;
  completed_at: string | null;
}

interface CreditCheckResult {
  creditScore: number;
  creditCategory: string;
  creditRemarks: string;
  bureauReport: {
    totalAccounts: number;
    activeAccounts: number;
    delinquentAccounts: number;
    inquiries6Months: number;
    creditUtilizationPct: number;
  } | null;
  repaymentHistory: {
    totalLoans: number;
    activeLoans: number;
    completedLoans: number;
    defaultedLoans: number;
    totalRepayments: number;
    paidRepayments: number;
    onTimeRate: number;
    repaymentRate: number;
  };
  existingDebt: number;
  creditUtilization: number;
  passed: boolean;
}

interface RiskFactor {
  factor: string;
  risk: number;
  weight: number;
  detail: string;
}

interface RiskAssessmentResult {
  riskScore: number;
  riskLevel: string;
  weightedRisk: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
  details: {
    trustScore: number;
    accountAgeDays: number;
    kycStatus: string;
    agentVerificationCount: number;
  };
  passed: boolean;
}

interface DocumentItem {
  doc_type: string;
  status: string;
  notes: string | null;
  verifiedBy?: number | null;
  verifiedAt?: string | null;
  submittedAt: string | null;
}

interface DocumentValidationResult {
  documents: DocumentItem[];
  summary: {
    required: number;
    verified: number;
    pending: number;
    missing: number;
    rejected: number;
  };
  passed: boolean;
  allVerified: boolean;
}

interface ApprovalAuthority {
  roleLevel: number;
  title: string;
  approvalLimit: number;
  canApprove: boolean;
  canDisburse: boolean;
  canOverride: boolean;
  isWithinLimit: boolean;
  needsHigherApproval: boolean;
  loanAmount: number;
  requiredLevel: string | null;
}

// ── Fallback data ──

const FALLBACK_LOANS: LoanItem[] = [
  { id: 1, borrower_name: 'Ravi Kumar',  borrower_mobile: '9876543210', amount: 10000, repayment_plan: 'Daily',  status: 'active', trust_score: 78, credit_score: 720, current_review_step: 'active', review_steps_passed: 4, total_review_steps: 4, created_at: '2 months ago', disbursed_at: null },
  { id: 2, borrower_name: 'Sneha Patel', borrower_mobile: '9876543211', amount: 8000,  repayment_plan: 'Weekly', status: 'active', trust_score: 65, credit_score: 680, current_review_step: 'active', review_steps_passed: 4, total_review_steps: 4, created_at: '1 month ago', disbursed_at: null },
  { id: 3, borrower_name: 'Amit Sharma', borrower_mobile: '9876543212', amount: 5000,  repayment_plan: 'Daily',  status: 'applied', trust_score: 45, credit_score: 550, current_review_step: 'credit_check', review_steps_passed: 0, total_review_steps: 0, created_at: '1 day ago', disbursed_at: null },
  { id: 4, borrower_name: 'Priya Mehta', borrower_mobile: '9876543213', amount: 15000, repayment_plan: 'Monthly', status: 'risk_assessment', trust_score: 60, credit_score: 640, current_review_step: 'risk_assessment', review_steps_passed: 1, total_review_steps: 1, created_at: '3 days ago', disbursed_at: null },
  { id: 5, borrower_name: 'Arjun Reddy', borrower_mobile: '9876543214', amount: 12000, repayment_plan: 'Daily',  status: 'overdue', trust_score: 55, credit_score: 480, current_review_step: 'overdue', review_steps_passed: 3, total_review_steps: 3, created_at: '2 months ago', disbursed_at: null },
  { id: 6, borrower_name: 'Deepa Iyer',  borrower_mobile: '9876543215', amount: 5000,  repayment_plan: 'Weekly', status: 'completed', trust_score: 71, credit_score: 750, current_review_step: 'completed', review_steps_passed: 4, total_review_steps: 4, created_at: '4 months ago', disbursed_at: null },
  { id: 7, borrower_name: 'Kavita Nair', borrower_mobile: '9876543219', amount: 8000,  repayment_plan: 'Daily',  status: 'active', trust_score: 85, credit_score: 800, current_review_step: 'active', review_steps_passed: 4, total_review_steps: 4, created_at: '1 month ago', disbursed_at: null },
  { id: 8, borrower_name: 'Rahul Verma', borrower_mobile: '9876543218', amount: 3000,  repayment_plan: 'Daily',  status: 'rejected', trust_score: 28, credit_score: 350, current_review_step: 'rejected', review_steps_passed: 0, total_review_steps: 0, created_at: '5 days ago', disbursed_at: null },
];

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Needs Review' },
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  applied: { color: '#9A6200', bg: '#FEF3DC', label: 'Applied' },
  credit_check: { color: '#E67E22', bg: '#FDF2E9', label: 'Credit Check' },
  risk_assessment: { color: '#8E44AD', bg: '#F4ECF7', label: 'Risk Assessment' },
  document_validation: { color: '#2980B9', bg: '#EBF5FB', label: 'Doc Validation' },
  approved: { color: '#2562A8', bg: '#EBF2FB', label: 'Approved' },
  rejected: { color: '#A02020', bg: '#FDEAEA', label: 'Rejected' },
  disbursed: { color: '#5A3E9B', bg: '#F0EBFF', label: 'Disbursed' },
  active: { color: '#0B6B4A', bg: '#E3F5EE', label: 'Active' },
  overdue: { color: '#A02020', bg: '#FDEAEA', label: 'Overdue' },
  completed: { color: '#0B6B4A', bg: '#E3F5EE', label: 'Completed' },
  defaulted: { color: '#6C1010', bg: '#FBEAEA', label: 'Defaulted' },
};

const REVIEW_STEPS: { key: ReviewStep; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'credit_check', label: 'Credit Check', icon: 'stats-chart' },
  { key: 'risk_assessment', label: 'Risk Assessment', icon: 'shield-checkmark' },
  { key: 'document_validation', label: 'Documents', icon: 'document-text' },
  { key: 'final_approval', label: 'Final Approval', icon: 'checkmark-done' },
];

const RISK_COLORS: Record<string, string> = {
  very_low: '#0B6B4A',
  low: '#2562A8',
  moderate: '#E67E22',
  high: '#D35400',
  critical: '#A02020',
};

const CREDIT_CATEGORY_COLORS: Record<string, string> = {
  excellent: '#0B6B4A',
  good: '#2562A8',
  fair: '#E67E22',
  poor: '#D35400',
  very_poor: '#A02020',
};

// ── Component ──

export default function AdminLoansScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loans, setLoans] = useState<LoanItem[]>(FALLBACK_LOANS);
  const [selectedLoan, setSelectedLoan] = useState<LoanItem | null>(null);
  const [activeStep, setActiveStep] = useState<ReviewStep | null>(null);

  // Review state
  const [loading, setLoading] = useState(false);
  const [creditCheck, setCreditCheck] = useState<CreditCheckResult | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentResult | null>(null);
  const [docValidation, setDocValidation] = useState<DocumentValidationResult | null>(null);
  const [authority, setAuthority] = useState<ApprovalAuthority | null>(null);
  const [reviewStepStatuses, setReviewStepStatuses] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // ── API calls ──

  const runCreditCheck = useCallback(async () => {
    if (!selectedLoan) return;
    setReviewLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_CREDIT_CHECK(selectedLoan.id), { method: 'POST' });
      if (res.success && res.data) {
        setCreditCheck(res.data.creditCheck);
      } else if (!res.success) {
        console.warn('Credit check API failed:', res.error);
      }
    } catch (e) { console.warn('Credit check error:', e); }
    setReviewLoading(false);
  }, [selectedLoan]);

  const completeCreditCheck = useCallback(async (status: 'passed' | 'failed') => {
    if (!selectedLoan) return;
    setReviewLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_CREDIT_CHECK_COMPLETE(selectedLoan.id), {
        method: 'POST',
        body: { status, notes: '' },
      });
      if (res.success) {
        setReviewStepStatuses((prev) => ({ ...prev, credit_check: status }));
        if (status === 'passed') setActiveStep('risk_assessment');
        else setSelectedLoan(null);
        Alert.alert(status === 'passed' ? 'Credit Check Approved' : 'Credit Check Failed',
          status === 'passed' ? 'Proceed to Risk Assessment.' : 'Loan has been rejected.');
      }
    } catch (e) { console.warn('Credit check complete error:', e); }
    setReviewLoading(false);
  }, [selectedLoan]);

  const runRiskAssessment = useCallback(async () => {
    if (!selectedLoan) return;
    setReviewLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_RISK_ASSESSMENT(selectedLoan.id), { method: 'POST' });
      if (res.success && res.data) {
        setRiskAssessment(res.data.riskAssessment);
      } else if (!res.success) {
        console.warn('Risk assessment API failed:', res.error);
      }
    } catch (e) { console.warn('Risk assessment error:', e); }
    setReviewLoading(false);
  }, [selectedLoan]);

  const completeRiskAssessment = useCallback(async (status: 'passed' | 'failed') => {
    if (!selectedLoan) return;
    setReviewLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_RISK_ASSESSMENT_COMPLETE(selectedLoan.id), {
        method: 'POST',
        body: { status, notes: '' },
      });
      if (res.success) {
        setReviewStepStatuses((prev) => ({ ...prev, risk_assessment: status }));
        if (status === 'passed') setActiveStep('document_validation');
        else setSelectedLoan(null);
        Alert.alert(status === 'passed' ? 'Risk Assessment Passed' : 'Risk Assessment Failed',
          status === 'passed' ? 'Proceed to Document Validation.' : 'Loan has been rejected.');
      }
    } catch (e) { console.warn('Risk assessment complete error:', e); }
    setReviewLoading(false);
  }, [selectedLoan]);

  const loadDocuments = useCallback(async () => {
    if (!selectedLoan) return;
    setReviewLoading(true);
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_DOCUMENTS(selectedLoan.id));
      if (res.success && res.data) {
        setDocValidation(res.data);
      } else if (!res.success) {
        console.warn('Documents API failed:', res.error);
      }
    } catch (e) { console.warn('Documents error:', e); }
    setReviewLoading(false);
  }, [selectedLoan]);

  const handleVerifyDoc = useCallback(async (docType: string, status: 'verified' | 'rejected') => {
    if (!selectedLoan) return;
    try {
      await apiFetch(ENDPOINTS.LOAN_DOCUMENT_VERIFY(selectedLoan.id), {
        method: 'POST',
        body: { doc_type: docType, status, notes: docNotes },
      });
      loadDocuments();
    } catch (e) { console.warn('Verify doc error:', e); }
  }, [selectedLoan, docNotes, loadDocuments]);

  const checkAuthority = useCallback(async () => {
    if (!selectedLoan) return;
    try {
      const res = await apiFetch(ENDPOINTS.LOAN_APPROVE(selectedLoan.id), {
        method: 'POST',
        body: { notes: approveNote },
      });
      if (res.success) {
        setReviewStepStatuses((prev) => ({ ...prev, final_approval: 'passed' }));
        Alert.alert('Loan Approved', 'The loan is ready for disbursement.');
        setSelectedLoan(null);
      } else {
        Alert.alert('Approval Failed', res.error || 'Check approval limits.');
      }
    } catch (e) { console.warn('Check authority error:', e); }
  }, [selectedLoan, approveNote]);

  const handleFinalApprove = useCallback(async () => {
    setReviewLoading(true);
    try {
      const res = await apiFetch<{ authority?: any }>(ENDPOINTS.LOAN_APPROVE(selectedLoan!.id), {
        method: 'POST',
        body: { notes: approveNote },
      });
      if (res.success) {
        const d = res.data;
        if (d?.authority) {
          setAuthority(d.authority);
          Alert.alert('Approval Limit Exceeded',
            `₹${selectedLoan!.amount.toLocaleString('en-IN')} exceeds your limit of ₹${d.authority.approvalLimit.toLocaleString('en-IN')}. (${d.authority.title})\n\nRequires higher-level approval.`);
        } else {
          setReviewStepStatuses((prev) => ({ ...prev, final_approval: 'passed' }));
          Alert.alert('Loan Approved', 'The loan is now ready for disbursement.');
          setSelectedLoan(null);
        }
      } else {
        Alert.alert('Approval Failed', res.error || 'Unknown error');
      }
    } catch (e) { console.warn('Final approval error:', e); }
    setReviewLoading(false);
  }, [selectedLoan, approveNote]);

  const handleReject = useCallback(async () => {
    if (!selectedLoan || !rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a rejection reason.');
      return;
    }
    setReviewLoading(true);
    try {
      const step = activeStep || 'credit_check';
      const res = await apiFetch(ENDPOINTS.LOAN_REJECT(selectedLoan.id), {
        method: 'POST',
        body: { reason: rejectReason, step },
      });
      if (res.success) {
        Alert.alert('Loan Rejected', 'The borrower has been notified.');
        setSelectedLoan(null);
        setRejectReason('');
      } else {
        console.warn('Reject failed:', res.error);
      }
    } catch (e) { console.warn('Reject error:', e); }
    setReviewLoading(false);
  }, [selectedLoan, rejectReason, activeStep]);

  // ── Fallback data for offline/dev ──

  const fallbackCreditCheck = useCallback((): CreditCheckResult => ({
    creditScore: selectedLoan?.credit_score || 650,
    creditCategory: (selectedLoan?.credit_score || 650) >= 750 ? 'excellent' : (selectedLoan?.credit_score || 650) >= 650 ? 'good' : 'fair',
    creditRemarks: 'Credit history review completed',
    bureauReport: {
      totalAccounts: 3, activeAccounts: 1, delinquentAccounts: 0,
      inquiries6Months: 2, creditUtilizationPct: 35,
    },
    repaymentHistory: {
      totalLoans: 2, activeLoans: 1, completedLoans: 1, defaultedLoans: 0,
      totalRepayments: 50, paidRepayments: 45, onTimeRate: 85, repaymentRate: 90,
    },
    existingDebt: 5000,
    creditUtilization: 25,
    passed: true,
  }), [selectedLoan]);

  const fallbackRiskAssessment = useCallback((): RiskAssessmentResult => {
    const score = selectedLoan?.credit_score || 650;
    return {
      riskScore: score > 700 ? 75 : score > 600 ? 55 : 35,
      riskLevel: score > 700 ? 'low' : score > 600 ? 'moderate' : 'high',
      weightedRisk: 100 - (score > 700 ? 75 : score > 600 ? 55 : 35),
      riskFactors: [
        { factor: 'Credit Score', risk: score > 700 ? 10 : score > 600 ? 30 : 55, weight: 0.30, detail: `Score ${score}/900` },
        { factor: 'Repayment History', risk: 20, weight: 0.25, detail: '85% on-time, 90% repaid' },
        { factor: 'Income Stability', risk: 30, weight: 0.15, detail: `Trust score: ${selectedLoan?.trust_score || 50}/100` },
        { factor: 'Existing Debt', risk: 15, weight: 0.10, detail: '₹5,000 existing debt' },
        { factor: 'KYC Completeness', risk: 5, weight: 0.10, detail: 'Verified' },
        { factor: 'Account Age', risk: 20, weight: 0.05, detail: '90 days since registration' },
        { factor: 'Loan Amount', risk: 30, weight: 0.05, detail: `₹${selectedLoan?.amount.toLocaleString('en-IN') || 0} requested` },
      ],
      recommendations: ['Standard processing — low risk', 'Consider requiring auto-pay mandate'],
      details: { trustScore: selectedLoan?.trust_score || 50, accountAgeDays: 90, kycStatus: 'verified', agentVerificationCount: 1 },
      passed: true,
    };
  }, [selectedLoan]);

  const fallbackDocs = useCallback((): DocumentValidationResult => ({
    documents: [
      { doc_type: 'aadhaar', status: 'verified', notes: 'Auto-verified from KYC', verifiedAt: null, submittedAt: '2 days ago', verifiedBy: null },
      { doc_type: 'pan', status: 'verified', notes: 'Auto-verified from KYC', verifiedAt: null, submittedAt: '2 days ago', verifiedBy: null },
      { doc_type: 'bank_statement', status: 'pending', notes: 'Uploaded — awaiting verification', verifiedAt: null, submittedAt: '1 day ago', verifiedBy: null },
      { doc_type: 'photo', status: 'not_submitted', notes: 'Not yet uploaded', verifiedAt: null, submittedAt: null, verifiedBy: null },
    ],
    summary: { required: 4, verified: 2, pending: 1, missing: 1, rejected: 0 },
    passed: false,
    allVerified: false,
  }), []);

  const fallbackAuthority = useCallback((): ApprovalAuthority => ({
    roleLevel: 3, title: 'Super Admin', approvalLimit: 50000,
    canApprove: true, canDisburse: true, canOverride: true,
    isWithinLimit: (selectedLoan?.amount || 0) <= 50000,
    needsHigherApproval: (selectedLoan?.amount || 0) > 50000,
    loanAmount: selectedLoan?.amount || 0, requiredLevel: null,
  }), [selectedLoan]);

  // ── Derived state ──

  const filteredLoans = useMemo(() => {
    if (activeFilter === 'all') return loans;
    if (activeFilter === 'review') {
      return loans.filter((l) =>
        ['applied', 'credit_check', 'risk_assessment', 'document_validation'].includes(l.status)
      );
    }
    return loans.filter((l) => l.status === activeFilter);
  }, [loans, activeFilter]);

  const reviewStepStatus = useCallback((step: ReviewStep): string | null => {
    if (reviewStepStatuses[step]) return reviewStepStatuses[step];
    return null;
  }, [reviewStepStatuses]);

  // ── Step content renderers ──

  const renderStepIndicator = () => {
    if (!selectedLoan) return null;
    const reviewStatuses = ['applied', 'credit_check', 'risk_assessment', 'document_validation'];
    const isInReview = reviewStatuses.includes(selectedLoan.status);

    return (
      <View style={styles.stepIndicator}>
        {REVIEW_STEPS.map((step, idx) => {
          const stepStatus = reviewStepStatus(step.key);
          const isActive = activeStep === step.key;
          const isPast = ['passed', 'skipped'].includes(stepStatus || '');
          const isFailed = stepStatus === 'failed';
          const isPending = !stepStatus || stepStatus === 'pending';

          let stepColor = colors.text3;
          let stepBg = colors.surface;
          if (isPast) { stepColor = colors.green; stepBg = '#E3F5EE'; }
          if (isFailed) { stepColor = colors.red; stepBg = '#FDEAEA'; }
          if (isActive) { stepColor = colors.primary; stepBg = colors.primaryBg; }

          return (
            <Pressable
              key={step.key}
              style={styles.stepItem}
              onPress={() => { if (selectedLoan) setActiveStep(step.key); }}
            >
              <View style={[styles.stepCircle, { backgroundColor: stepBg, borderColor: stepColor }]}>
                <Ionicons
                  name={isPast ? 'checkmark-circle' : isFailed ? 'close-circle' : step.icon}
                  size={isPast || isFailed ? 20 : 18}
                  color={stepColor}
                />
              </View>
              <Text style={[styles.stepLabel, { color: isActive ? colors.primary : colors.text3 }]}>
                {step.label}
              </Text>
              {idx < REVIEW_STEPS.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: isPast ? colors.green : colors.border }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderCreditCheck = () => {
    const data = creditCheck || fallbackCreditCheck();
    return (
      <View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Credit Score Summary</Text>
          <View style={styles.scoreRow}>
            <View style={[styles.bigScoreBadge, { backgroundColor: CREDIT_CATEGORY_COLORS[data.creditCategory] || colors.primary }]}>
              <Text style={styles.bigScoreText}>{data.creditScore}</Text>
              <Text style={styles.bigScoreSub}>/ 900</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.categoryBadge, { backgroundColor: (CREDIT_CATEGORY_COLORS[data.creditCategory] || colors.primary) + '20' }]}>
                <Text style={[styles.categoryText, { color: CREDIT_CATEGORY_COLORS[data.creditCategory] || colors.primary }]}>
                  {data.creditCategory.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.remarkText, { color: colors.text2 }]}>{data.creditRemarks}</Text>
            </View>
          </View>
        </View>

        {data.bureauReport && (
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bureau Report</Text>
            <View style={styles.grid2}>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.text3 }]}>Total Accounts</Text>
                <Text style={[styles.gridValue, { color: colors.text }]}>{data.bureauReport.totalAccounts}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.text3 }]}>Active</Text>
                <Text style={[styles.gridValue, { color: colors.text }]}>{data.bureauReport.activeAccounts}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.text3 }]}>Delinquent</Text>
                <Text style={[styles.gridValue, { color: data.bureauReport.delinquentAccounts > 0 ? colors.red : colors.green }]}>
                  {data.bureauReport.delinquentAccounts}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.text3 }]}>Utilization</Text>
                <Text style={[styles.gridValue, { color: colors.text }]}>{data.bureauReport.creditUtilizationPct}%</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={[styles.gridLabel, { color: colors.text3 }]}>Inquiries (6mo)</Text>
                <Text style={[styles.gridValue, { color: colors.text }]}>{data.bureauReport.inquiries6Months}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Repayment History</Text>
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>Total Loans</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{data.repaymentHistory.totalLoans}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>Completed</Text>
              <Text style={[styles.gridValue, { color: colors.green }]}>{data.repaymentHistory.completedLoans}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>On-Time Rate</Text>
              <Text style={[styles.gridValue, { color: data.repaymentHistory.onTimeRate >= 80 ? colors.green : colors.amber }]}>
                {data.repaymentHistory.onTimeRate}%
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>Repayment Rate</Text>
              <Text style={[styles.gridValue, { color: data.repaymentHistory.repaymentRate >= 80 ? colors.green : colors.amber }]}>
                {data.repaymentHistory.repaymentRate}%
              </Text>
            </View>
          </View>

          {/* Mini repayment bar */}
          <View style={[styles.miniBar, { backgroundColor: colors.border }]}>
            <View style={[styles.miniBarFill, { width: `${data.repaymentHistory.repaymentRate}%`, backgroundColor: data.repaymentHistory.repaymentRate >= 80 ? colors.green : colors.amber }]} />
          </View>
          <Text style={[styles.miniBarLabel, { color: colors.text3 }]}>
            {data.repaymentHistory.paidRepayments} of {data.repaymentHistory.totalRepayments} repayments made
          </Text>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Existing Debt</Text>
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>Total Debt</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>₹{data.existingDebt.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={[styles.gridLabel, { color: colors.text3 }]}>Utilization</Text>
              <Text style={[styles.gridValue, { color: data.creditUtilization > 50 ? colors.red : colors.text }]}>
                {data.creditUtilization}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
            onPress={() => completeCreditCheck('passed')}
            disabled={reviewLoading}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>{reviewLoading ? 'Submitting...' : 'Pass Credit Check'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }]}
            onPress={() => completeCreditCheck('failed')}
            disabled={reviewLoading}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Fail</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderRiskAssessment = () => {
    const data = riskAssessment || fallbackRiskAssessment();
    return (
      <View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.riskHeader}>
            <View style={[styles.riskScoreBadge, { backgroundColor: (RISK_COLORS[data.riskLevel] || colors.primary) + '20' }]}>
              <Text style={[styles.riskScoreMain, { color: RISK_COLORS[data.riskLevel] || colors.primary }]}>
                {data.riskScore}
              </Text>
              <Text style={[styles.riskScoreSub, { color: RISK_COLORS[data.riskLevel] || colors.primary }]}>/100</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.levelBadge, { backgroundColor: (RISK_COLORS[data.riskLevel] || colors.primary) + '20' }]}>
                <Text style={[styles.levelText, { color: RISK_COLORS[data.riskLevel] || colors.primary }]}>
                  {data.riskLevel.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.riskSubText, { color: colors.text2 }]}>Weighted risk: {data.weightedRisk}%</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Risk Factors</Text>
          {data.riskFactors.map((factor, idx) => (
            <View key={idx} style={[styles.factorRow, idx < data.riskFactors.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xl, marginBottom: spacing.xl }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.factorHeader}>
                  <Text style={[styles.factorName, { color: colors.text }]}>{factor.factor}</Text>
                  <Text style={[styles.factorWeight, { color: colors.text3 }]}>×{factor.weight}</Text>
                </View>
                <Text style={[styles.factorDetail, { color: colors.text3 }]}>{factor.detail}</Text>
              </View>
              <View style={[styles.factorLevel, { backgroundColor: factor.risk >= 70 ? '#FDEAEA' : factor.risk >= 40 ? '#FEF3DC' : '#E3F5EE' }]}>
                <Text style={[styles.factorLevelText, { color: factor.risk >= 70 ? colors.red : factor.risk >= 40 ? '#9A6200' : colors.green }]}>
                  {factor.risk >= 70 ? 'HIGH' : factor.risk >= 40 ? 'MED' : 'LOW'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommendations</Text>
          {data.recommendations.map((rec, idx) => (
            <View key={idx} style={styles.recRow}>
              <Ionicons name="bulb" size={16} color={colors.amber} style={{ marginRight: spacing.smd }} />
              <Text style={[styles.recText, { color: colors.text2 }]}>{rec}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
            onPress={() => completeRiskAssessment('passed')}
            disabled={reviewLoading}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>{reviewLoading ? 'Submitting...' : 'Accept Risk'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }]}
            onPress={() => completeRiskAssessment('failed')}
            disabled={reviewLoading}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Reject</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderDocuments = () => {
    const data = docValidation || fallbackDocs();
    return (
      <View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Required Documents ({data.summary.verified}/{data.summary.required} verified)
          </Text>
          <View style={styles.docSummaryRow}>
            <View style={styles.docSummaryItem}>
              <Text style={[styles.docSummaryValue, { color: colors.green }]}>{data.summary.verified}</Text>
              <Text style={[styles.docSummaryLabel, { color: colors.text3 }]}>Verified</Text>
            </View>
            <View style={styles.docSummaryItem}>
              <Text style={[styles.docSummaryValue, { color: colors.amber }]}>{data.summary.pending}</Text>
              <Text style={[styles.docSummaryLabel, { color: colors.text3 }]}>Pending</Text>
            </View>
            <View style={styles.docSummaryItem}>
              <Text style={[styles.docSummaryValue, { color: colors.red }]}>{data.summary.missing}</Text>
              <Text style={[styles.docSummaryLabel, { color: colors.text3 }]}>Missing</Text>
            </View>
            <View style={styles.docSummaryItem}>
              <Text style={[styles.docSummaryValue, { color: colors.red }]}>{data.summary.rejected}</Text>
              <Text style={[styles.docSummaryLabel, { color: colors.text3 }]}>Rejected</Text>
            </View>
          </View>
        </View>

        {data.documents.map((doc, idx) => {
          const docColor = doc.status === 'verified' ? colors.green
            : doc.status === 'rejected' ? colors.red
            : doc.status === 'pending' ? colors.amber
            : colors.text3;
          const docBg = doc.status === 'verified' ? '#E3F5EE'
            : doc.status === 'rejected' ? '#FDEAEA'
            : doc.status === 'pending' ? '#FEF3DC'
            : '#F2F3F5';

          return (
            <View key={idx} style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.docHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docType, { color: colors.text }]}>
                    {doc.doc_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={[styles.docStatus, { color: docColor }]}>
                    {doc.status === 'not_submitted' ? 'Not Submitted' : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </Text>
                  {doc.notes && <Text style={[styles.docNotes, { color: colors.text3 }]}>{doc.notes}</Text>}
                </View>
                <View style={[styles.docBadge, { backgroundColor: docBg }]}>
                  <Ionicons
                    name={doc.status === 'verified' ? 'checkmark-circle' : doc.status === 'rejected' ? 'close-circle' : doc.status === 'pending' ? 'time' : 'ellipse-outline'}
                    size={20} color={docColor}
                  />
                </View>
              </View>

              {(doc.status === 'pending' || doc.status === 'not_submitted') && (
                <View style={styles.docActions}>
                  <TextInput
                    style={[styles.docNoteInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
                    placeholder="Verification notes..."
                    placeholderTextColor={colors.text3}
                    value={docNotes}
                    onChangeText={setDocNotes}
                  />
                  <View style={styles.docActionRow}>
                    <Pressable
                      style={({ pressed }) => [styles.docActionBtn, { backgroundColor: colors.green }, pressed && { opacity: 0.85 }]}
                      onPress={() => handleVerifyDoc(doc.doc_type, 'verified')}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.docActionText}>Verify</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.docActionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }]}
                      onPress={() => handleVerifyDoc(doc.doc_type, 'rejected')}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                      <Text style={styles.docActionText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {data.allVerified && (
          <View style={[styles.allVerifiedBanner, { backgroundColor: '#E3F5EE' }]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={[styles.allVerifiedText, { color: colors.green }]}>All documents verified — auto-advancing</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFinalApproval = () => {
    const auth = authority || fallbackAuthority();
    return (
      <View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Approval Authority</Text>
          <View style={styles.authRow}>
            <View style={[styles.authAvatar, { backgroundColor: colors.primaryBg }]}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.authTitle, { color: colors.text }]}>{auth.title}</Text>
              <Text style={[styles.authLevel, { color: colors.text3 }]}>Level {auth.roleLevel} Admin</Text>
            </View>
          </View>

          <View style={[styles.authLimitBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={styles.authLimitRow}>
              <Text style={[styles.authLimitLabel, { color: colors.text3 }]}>Your Approval Limit</Text>
              <Text style={[styles.authLimitValue, { color: colors.text }]}>₹{auth.approvalLimit.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.authDivider, { backgroundColor: colors.border }]} />
            <View style={styles.authLimitRow}>
              <Text style={[styles.authLimitLabel, { color: colors.text3 }]}>Loan Amount</Text>
              <Text style={[styles.authLimitValue, { color: auth.isWithinLimit ? colors.green : colors.red }]}>
                ₹{auth.loanAmount.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.authDivider, { backgroundColor: colors.border }]} />
            {auth.needsHigherApproval ? (
              <View style={[styles.authWarning, { backgroundColor: '#FEF3DC' }]}>
                <Ionicons name="warning" size={18} color="#9A6200" />
                <Text style={[styles.authWarningText, { color: '#9A6200' }]}>
                  Exceeds your limit. Requires Level {auth.requiredLevel} approval.
                </Text>
              </View>
            ) : (
              <View style={[styles.authOk, { backgroundColor: '#E3F5EE' }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                <Text style={[styles.authOkText, { color: colors.green }]}>Within your approval limit</Text>
              </View>
            )}
          </View>

          {auth.canOverride && (
            <View style={[styles.overrideBadge, { backgroundColor: colors.purpleBg || '#F0EBFF' }]}>
              <Ionicons name="flash" size={16} color={colors.purple || '#5A3E9B'} />
              <Text style={[styles.overrideText, { color: colors.purple || '#5A3E9B' }]}>Override authority — can approve any amount</Text>
            </View>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Decision</Text>

          <TextInput
            style={[styles.noteInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
            placeholder="Approval notes (optional)"
            placeholderTextColor={colors.text3}
            value={approveNote}
            onChangeText={setApproveNote}
            multiline
            numberOfLines={3}
          />

          <View style={styles.approveActionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.green, flex: 1 }, pressed && { opacity: 0.85 }]}
              onPress={handleFinalApprove}
              disabled={reviewLoading || auth.needsHigherApproval}
            >
              <Ionicons name="checkmark-done" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{reviewLoading ? 'Processing...' : 'Approve Loan'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: colors.border, borderWidth: 1, backgroundColor: '#FDEAEA' }]}>
          <Text style={[styles.sectionTitle, { color: colors.red }]}>Reject Loan</Text>
          <TextInput
            style={[styles.noteInput, { backgroundColor: '#fff', color: colors.text, borderColor: colors.red }]}
            placeholder="Enter rejection reason (min 10 chars)..."
            placeholderTextColor={colors.text3}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            numberOfLines={3}
          />
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.red }, pressed && { opacity: 0.85 }]}
            onPress={handleReject}
            disabled={reviewLoading}
          >
            <Ionicons name="close-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Reject Loan</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ── Main render ──

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          {selectedLoan ? (
            <Pressable onPress={() => { setSelectedLoan(null); setActiveStep(null); setCreditCheck(null); setRiskAssessment(null); setDocValidation(null); setAuthority(null); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
              <Text style={styles.topNavTitle}>Loan Review</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.topNavTitle}>Loan Management</Text>
              <Text style={styles.topNavSub}>v2 — Multi-step review workflow</Text>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedLoan ? (
          <>
            {/* ── Borrower Info ── */}
            <View style={[styles.borrowerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.borrowerHeader}>
                <View style={[styles.borrowerAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.borrowerAvatarText, { color: colors.primary }]}>
                    {selectedLoan.borrower_name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.borrowerName, { color: colors.text }]}>{selectedLoan.borrower_name}</Text>
                  <Text style={[styles.borrowerMobile, { color: colors.text3 }]}>{selectedLoan.borrower_mobile}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_CONFIG[selectedLoan.status] || STATUS_CONFIG.applied).bg }]}>
                  <Text style={[styles.statusBadgeText, { color: (STATUS_CONFIG[selectedLoan.status] || STATUS_CONFIG.applied).color }]}>
                    {(STATUS_CONFIG[selectedLoan.status] || STATUS_CONFIG.applied).label}
                  </Text>
                </View>
              </View>

              <View style={[styles.borrowerMeta, { borderTopColor: colors.border }]}>
                <View style={styles.borrowerMetaItem}>
                  <Text style={[styles.borrowerMetaLabel, { color: colors.text3 }]}>Amount</Text>
                  <Text style={[styles.borrowerMetaValue, { color: colors.text }]}>₹{selectedLoan.amount.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.borrowerMetaItem}>
                  <Text style={[styles.borrowerMetaLabel, { color: colors.text3 }]}>Plan</Text>
                  <Text style={[styles.borrowerMetaValue, { color: colors.text }]}>{selectedLoan.repayment_plan}</Text>
                </View>
                <View style={styles.borrowerMetaItem}>
                  <Text style={[styles.borrowerMetaLabel, { color: colors.text3 }]}>Credit Score</Text>
                  <Text style={[styles.borrowerMetaValue, { color: colors.text }]}>{selectedLoan.credit_score}</Text>
                </View>
                <View style={styles.borrowerMetaItem}>
                  <Text style={[styles.borrowerMetaLabel, { color: colors.text3 }]}>Trust Score</Text>
                  <Text style={[styles.borrowerMetaValue, { color: colors.text }]}>{selectedLoan.trust_score}</Text>
                </View>
              </View>
            </View>

            {/* ── Step Progress ── */}
            {renderStepIndicator()}

            {/* ── Step Content ── */}
            {activeStep === 'credit_check' && renderCreditCheck()}
            {activeStep === 'risk_assessment' && renderRiskAssessment()}
            {activeStep === 'document_validation' && renderDocuments()}
            {activeStep === 'final_approval' && renderFinalApproval()}

            {/* ── Step Start Buttons (no active step selected) ── */}
            {!activeStep && (
              <View style={styles.startSteps}>
                {REVIEW_STEPS.map((step) => {
                  const stepStatus = reviewStepStatus(step.key);
                  const isDone = stepStatus === 'passed';

                  return (
                    <Pressable
                      key={step.key}
                      style={({ pressed }) => [styles.startStepCard, { backgroundColor: colors.surface, borderColor: isDone ? colors.green : colors.border }, pressed && { opacity: 0.9 }]}
                      onPress={() => {
                        setActiveStep(step.key);
                        if (step.key === 'credit_check') runCreditCheck();
                        if (step.key === 'risk_assessment') runRiskAssessment();
                        if (step.key === 'document_validation') loadDocuments();
                      }}
                    >
                      <View style={[styles.startStepIcon, { backgroundColor: isDone ? '#E3F5EE' : colors.primaryBg }]}>
                        <Ionicons
                          name={isDone ? 'checkmark-circle' : step.icon}
                          size={22}
                          color={isDone ? colors.green : colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.startStepLabel, { color: colors.text }]}>{step.label}</Text>
                        <Text style={[styles.startStepSub, { color: colors.text3 }]}>
                          {isDone ? 'Completed' : 'Ready to start'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={{ height: spacing.xl5 * 2 }} />
          </>
        ) : (
          <>
            {/* ── Filter ── */}
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

            {/* ── Loan List ── */}
            {filteredLoans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={colors.text3} />
                <Text style={[styles.emptyTitle, { color: colors.text2 }]}>No loans found</Text>
                <Text style={[styles.emptySub, { color: colors.text3 }]}>No loans match the current filter.</Text>
              </View>
            ) : (
              filteredLoans.map((loan) => {
                const sc = STATUS_CONFIG[loan.status] || STATUS_CONFIG.applied;
                const isInReview = ['applied', 'credit_check', 'risk_assessment', 'document_validation'].includes(loan.status);
                return (
                  <Pressable
                    key={loan.id}
                    style={({ pressed }) => [styles.loanCard, {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderLeftColor: isInReview ? colors.primary : sc.color,
                      borderLeftWidth: isInReview ? 4 : 4,
                    }, pressed && { opacity: 0.92 }]}
                    onPress={() => {
                      setSelectedLoan(loan);
                      setActiveStep(null);
                      setCreditCheck(null);
                      setRiskAssessment(null);
                      setDocValidation(null);
                      setAuthority(null);
                      // Pre-populate review steps as passed for completed loans
                      const terminalStatuses = ['approved', 'disbursed', 'active', 'overdue', 'completed', 'defaulted'];
                      if (terminalStatuses.includes(loan.status)) {
                        setReviewStepStatuses({
                          credit_check: 'passed',
                          risk_assessment: 'passed',
                          document_validation: 'passed',
                          final_approval: 'passed',
                        });
                      } else if (loan.status === 'rejected') {
                        setReviewStepStatuses({});
                      } else {
                        setReviewStepStatuses({});
                      }
                    }}
                  >
                    <View style={styles.loanRow}>
                      <View style={[styles.loanAvatar, { backgroundColor: colors.primaryBg }]}>
                        <Text style={[styles.loanAvatarText, { color: colors.primary }]}>
                          {loan.borrower_name.split(' ').map(n => n[0]).join('')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.loanNameRow}>
                          <Text style={[styles.loanBorrowerName, { color: colors.text }]}>{loan.borrower_name}</Text>
                          <View style={[styles.loanStatusBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.loanStatusText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        <View style={styles.loanMetaRow}>
                          <Text style={[styles.loanAmount, { color: colors.text }]}>₹{loan.amount.toLocaleString('en-IN')}</Text>
                          <Text style={[styles.loanMetaDot, { color: colors.text3 }]}>·</Text>
                          <Text style={[styles.loanPlan, { color: colors.text3 }]}>{loan.repayment_plan}</Text>
                          <Text style={[styles.loanMetaDot, { color: colors.text3 }]}>·</Text>
                          <Text style={[styles.loanCredit, { color: colors.text3 }]}>CS: {loan.credit_score}</Text>
                        </View>
                        {isInReview && (
                          <View style={[styles.reviewStepBadge, { backgroundColor: colors.primaryBg }]}>
                            <Text style={[styles.reviewStepText, { color: colors.primary }]}>
                              {loan.current_review_step.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3 },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterScroll: { marginTop: spacing.md, marginBottom: spacing.xs },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterTab: { paddingHorizontal: spacing.xl4, paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl5 * 2 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: spacing.xl },
  emptySub: { fontSize: 13, marginTop: spacing.sm },

  // Loan list cards
  loanCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, borderLeftWidth: 4, padding: spacing.xl + 2, marginBottom: spacing.smd },
  loanRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  loanAvatar: { width: 42, height: 42, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  loanAvatarText: { fontSize: 14, fontWeight: '700' },
  loanNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  loanBorrowerName: { fontWeight: '700', fontSize: 14 },
  loanStatusBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 2, borderRadius: radii.full },
  loanStatusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  loanMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.ssm },
  loanAmount: { fontWeight: '600', fontSize: 13 },
  loanMetaDot: { fontSize: 10 },
  loanPlan: { fontSize: 11 },
  loanCredit: { fontSize: 11 },
  reviewStepBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.full, marginTop: spacing.sm },
  reviewStepText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Borrower detail header
  borrowerCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, marginTop: spacing.smd, overflow: 'hidden' },
  borrowerHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2, gap: spacing.xl },
  borrowerAvatar: { width: 44, height: 44, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  borrowerAvatarText: { fontSize: 15, fontWeight: '700' },
  borrowerName: { fontWeight: '700', fontSize: 16 },
  borrowerMobile: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  borrowerMeta: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.xl + 2 },
  borrowerMetaItem: { flex: 1, alignItems: 'center' },
  borrowerMetaLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  borrowerMetaValue: { fontSize: 13, fontWeight: '700', marginTop: spacing.ssm },

  // Step indicator
  stepIndicator: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.smd, paddingVertical: spacing.smd },
  stepItem: { alignItems: 'center', flex: 1, position: 'relative' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 9, fontWeight: '600', marginTop: spacing.ssm, textAlign: 'center' },
  stepLine: { position: 'absolute', left: '60%', top: 16, width: '80%', height: 2 },

  // Step start buttons
  startSteps: { gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  startStepCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, gap: spacing.xl },
  startStepIcon: { width: 44, height: 44, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  startStepLabel: { fontWeight: '700', fontSize: 14 },
  startStepSub: { fontSize: 11, marginTop: 1 },

  // Section cards
  sectionCard: { borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  sectionTitle: { fontWeight: '700', fontSize: 14, marginBottom: spacing.xl },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  bigScoreBadge: { width: 80, height: 80, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  bigScoreText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  bigScoreSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  categoryText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  remarkText: { fontSize: 11, marginTop: spacing.sm, fontWeight: '500' },

  // Grid layout
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', marginBottom: spacing.xl },
  gridLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  gridValue: { fontSize: 16, fontWeight: '700', marginTop: spacing.ssm },

  // Mini bar
  miniBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: spacing.sm },
  miniBarFill: { height: '100%', borderRadius: 3 },
  miniBarLabel: { fontSize: 10, marginTop: spacing.ssm, fontWeight: '500' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.xl4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl + 2, borderRadius: radii.xs },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Risk assessment
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  riskScoreBadge: { width: 80, height: 80, borderRadius: radii.lg, justifyContent: 'center', alignItems: 'center' },
  riskScoreMain: { fontSize: 26, fontWeight: '800' },
  riskScoreSub: { fontSize: 10, fontWeight: '600' },
  levelBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full },
  levelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  riskSubText: { fontSize: 11, marginTop: spacing.sm, fontWeight: '500' },
  factorRow: { flexDirection: 'row', alignItems: 'center' },
  factorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  factorName: { fontSize: 13, fontWeight: '600' },
  factorWeight: { fontSize: 11, fontWeight: '500' },
  factorDetail: { fontSize: 11, marginTop: 2 },
  factorLevel: { paddingHorizontal: spacing.md, paddingVertical: spacing.ssm, borderRadius: radii.full, marginLeft: spacing.smd },
  factorLevelText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  recText: { fontSize: 12, flex: 1 },

  // Documents
  docSummaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  docSummaryItem: { alignItems: 'center' },
  docSummaryValue: { fontSize: 22, fontWeight: '800' },
  docSummaryLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  docCard: { borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl + 2, marginHorizontal: spacing.lg, marginTop: spacing.smd },
  docHeader: { flexDirection: 'row', alignItems: 'center' },
  docType: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  docStatus: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  docNotes: { fontSize: 10, marginTop: 1 },
  docBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  docActions: { marginTop: spacing.xl, gap: spacing.sm },
  docNoteInput: { borderWidth: 1, borderRadius: radii.xs, padding: spacing.md, fontSize: 12, height: 36 },
  docActionRow: { flexDirection: 'row', gap: spacing.smd },
  docActionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl4, paddingVertical: spacing.md, borderRadius: radii.xs },
  docActionText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  allVerifiedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, marginHorizontal: spacing.lg, marginTop: spacing.smd, padding: spacing.xl, borderRadius: radii.xs },
  allVerifiedText: { fontSize: 12, fontWeight: '600' },

  // Final approval
  authRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  authAvatar: { width: 44, height: 44, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  authTitle: { fontWeight: '700', fontSize: 15 },
  authLevel: { fontSize: 11, marginTop: 1 },
  authLimitBox: { borderRadius: radii.xs, borderWidth: 1, padding: spacing.xl, marginTop: spacing.xl },
  authLimitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authLimitLabel: { fontSize: 11, fontWeight: '500' },
  authLimitValue: { fontSize: 15, fontWeight: '700' },
  authDivider: { height: 1, marginVertical: spacing.md },
  authWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xs, marginTop: spacing.sm },
  authWarningText: { fontSize: 11, fontWeight: '600', flex: 1 },
  authOk: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xs, marginTop: spacing.sm },
  authOkText: { fontSize: 11, fontWeight: '600' },
  overrideBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xs, marginTop: spacing.smd },
  overrideText: { fontSize: 11, fontWeight: '600' },
  noteInput: { borderWidth: 1, borderRadius: radii.xs, padding: spacing.md, fontSize: 13, marginBottom: spacing.xl, textAlignVertical: 'top', minHeight: 72 },
  approveActionRow: { gap: spacing.smd },
});
