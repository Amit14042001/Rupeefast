/**
 * RupeeFast — Shared TypeScript Types
 */

// ── User / Auth ──

export type UserRole = 'borrower' | 'investor' | 'agent';

export interface User {
  id: number;
  name: string;
  mobile: string;
  role: UserRole;
  email?: string;
  pan?: string;
  aadhaar?: string;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface LoginRequest {
  mobile: string;
  role: UserRole;
}

// ── Loan ──

export type LoanPlan = 'Daily' | 'Weekly' | 'Monthly';
export type LoanStatus = 'active' | 'completed' | 'defaulted' | 'pending';

export interface Loan {
  id: number;
  borrower_id: number;
  amount: number;
  plan: LoanPlan;
  purpose: string;
  status: LoanStatus;
  disbursed_at?: string;
  repaid_amount?: number;
  total_due?: number;
}

export interface LoanApplication {
  amount: number;
  plan: LoanPlan;
  purpose: string;
}

export interface LoanCalculation {
  amount: number;
  fee: number;
  reserveFund: number;
  receiveAmount: number;
  dailyPayment: number;
  weeklyPayment: number;
  monthlyPayment: number;
}

// ── Repayment / Schedule ──

export interface Repayment {
  id: number;
  loan_id: number;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_at?: string;
  type: 'daily' | 'weekly' | 'monthly';
}

export interface ScheduleEntry {
  date: string;
  amount: number;
  paid: boolean;
  icon: 'check' | 'clock';
  status: 'paid' | 'pending' | 'overdue';
}

// ── Dashboard ──

export interface BorrowerDashboard {
  loanBalance: number;
  repaidAmount: number;
  trustScore: number;
  dailyLimit: number;
  currentLoan?: Loan;
  schedule: Repayment[];
}

export interface InvestorDashboard {
  totalInvested: number;
  monthlyReturn: number;
  activeBorrowers: number;
  riskExposure: number;
  investments: Investment[];
}

export interface AgentDashboard {
  totalCollected: number;
  todaysVisits: number;
  pendingCollections: number;
  commission: number;
}

// ── Investment ──

export interface Investment {
  id: number;
  investor_id: number;
  amount: number;
  borrower_name: string;
  status: string;
  returns: number;
}

export interface InvestmentCalculation {
  amount: number;
  borrowersCount: number;
  monthlyReturn: number;
  riskPercent: number;
}

// ── Payment / Mandate ──

export interface Mandate {
  id: string;
  umrn?: string;
  status: 'active' | 'paused' | 'cancelled' | 'pending';
  maxAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  bankName: string;
}

export interface PaymentResponse {
  success: boolean;
  transaction_id?: string;
  mandate_id?: string;
  error?: string;
}

export type PaymentMethod = 'upi_autopay' | 'manual_upi' | 'debit_card' | 'net_banking';

// ── AI Score ──

export interface AIScoreResult {
  score: number;
  checks: string[];
  passed: boolean;
}

// ── API Response Shapes (match backend) ──

export interface SendOtpResponse {
  success: boolean;
  masked_mobile: string;
  message: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  user: User;
  token: string;
  message: string;
}

export interface DashboardResponse {
  user: User;
  activeLoan?: Loan;
  recentRepayments?: Repayment[];
  totalEarned?: number;
  investments?: Investment[];
  tasks?: any[];
}

export interface LoanApplyResponse {
  success: boolean;
  loan_id: number;
}

export interface LoanDisburseResponse {
  success: boolean;
  message: string;
  emi_count: number;
  emi_amount: number;
}

export interface KycSubmitResponse {
  success: boolean;
  kyc_id: number;
  status: string;
  message: string;
}

export interface KycStatusResponse {
  kyc: {
    id: number;
    user_id: number;
    aadhaar_number: string;
    pan_number: string;
    status: 'pending' | 'verified' | 'rejected';
    created_at: string;
    updated_at: string;
  } | null;
}

export interface CreditScoreResponse {
  score: {
    user_id: number;
    score: number;
    factors?: Record<string, number>;
    updated_at?: string;
  };
}

export interface MandatesResponse {
  mandates: Array<{
    id: number;
    user_id: number;
    loan_id: number | null;
    razorpay_subscription_id: string;
    razorpay_plan_id: string;
    method: string;
    status: 'active' | 'paused' | 'cancelled' | 'pending' | 'completed' | 'halted';
    amount: number;
    frequency: string;
    remaining_cycles: number;
    total_cycles: number;
    created_at: string;
    activated_at?: string;
  }>;
}

export interface TransactionsResponse {
  transactions: Array<{
    id: number;
    user_id: number;
    loan_id: number | null;
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    amount: number;
    type: string;
    status: string;
    method: string;
    notes?: string;
    created_at: string;
  }>;
}

// ── Loan Offers (Migration 008) ──

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'converted';
export type OfferSource = 'credit_engine' | 'admin' | 'campaign' | 'referral';

export interface LoanOffer {
  id: number;
  user_id: number;
  loan_id?: number;
  amount: number;
  interest_rate: number;
  tenure_days: number;
  processing_fee: number;
  status: OfferStatus;
  expires_at: string;
  source: OfferSource;
  metadata?: Record<string, any>;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface LoanOffersResponse {
  offers: LoanOffer[];
}

// ── Collection Logs (Migration 008) ──

export type CollectionType = 'field_visit' | 'phone_call' | 'legal_notice' | 'sms_reminder' | 'email_reminder' | 'home_visit' | 'workplace_visit';
export type CollectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type CollectionOutcome = 'no_response' | 'promise_to_pay' | 'partial_payment' | 'full_payment' | 'dispute' | 'refused' | 'not_home' | 'wrong_address' | 'deceased' | 'legal_referral';
export type ContactRelationship = 'self' | 'spouse' | 'parent' | 'neighbor' | 'employer' | 'guarantor' | 'other';
export type ContactMethod = 'in_person' | 'phone' | 'sms' | 'email' | 'third_party';

export interface CollectionLog {
  id: number;
  loan_id: number;
  agent_id: number;
  collection_type: CollectionType;
  status: CollectionStatus;
  contacted_person?: string;
  relationship?: ContactRelationship;
  contact_method?: ContactMethod;
  amount_promised?: number;
  promise_date?: string;
  amount_collected?: number;
  payment_id?: number;
  notes?: string;
  outcome?: CollectionOutcome;
  location_lat?: number;
  location_lng?: number;
  duration_minutes?: number;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

export interface CollectionLogsResponse {
  logs: CollectionLog[];
}

// ── Fraud Events (Migration 008) ──

export type FraudEventType = 'multiple_login' | 'suspicious_device' | 'kyc_tampering' | 'payment_anomaly' | 'identity_theft' | 'account_takeover' | 'synthetic_identity' | 'document_forgery' | 'circle_fraud' | 'application_abuse' | 'collusion' | 'chargeback' | 'unusual_location' | 'velocity_breach' | 'manual_review';
export type FraudSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type FraudStatus = 'open' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved';
export type FraudDetectedBy = 'system' | 'admin_rule' | 'manual' | 'agent_report' | 'external_api';

export interface FraudEvent {
  id: number;
  user_id?: number;
  loan_id?: number;
  event_type: FraudEventType;
  severity: FraudSeverity;
  status: FraudStatus;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  risk_score_delta: number;
  detected_by: FraudDetectedBy;
  ip_address?: string;
  device_id?: string;
  action_taken?: string;
  resolved_at?: string;
  resolved_by?: number;
  resolution?: string;
  created_at: string;
}

export interface FraudEventsResponse {
  events: FraudEvent[];
}

export interface ApiError {
  error: string;
  statusCode?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
