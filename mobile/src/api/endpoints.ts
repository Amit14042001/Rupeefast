/**
 * RupeeFast — API Endpoints
 * Central registry of all backend routes.
 * Matches the actual routes defined in backend/src/server.js.
 */

export const ENDPOINTS = {
  // ── Auth ──
  /** POST: Send OTP to mobile. Body: { mobile, role } */
  SEND_OTP: '/auth/send-otp',
  /** POST: Verify OTP and receive JWT. Body: { mobile, otp } */
  VERIFY_OTP: '/auth/verify-otp',
  /** POST: Mock login (dev only, requires ALLOW_MOCK_OTP=true). Body: { mobile, role } */
  LOGIN: '/auth/login',
  /** POST: Logout and revoke token. Auth required. */
  LOGOUT: '/auth/logout',

  // ── User / Dashboard ──
  /** GET: Role-specific dashboard data. Auth required. */
  DASHBOARD: (userId: number) => `/user/${userId}/dashboard`,

  // ── Loans ──
  /** POST: Apply for a loan. Auth required. Body: { amount, plan, purpose } */
  APPLY_LOAN: '/loans/apply',
  /** POST: Disburse an approved loan. Auth required. Body: { loan_id } */
  DISBURSE_LOAN: '/loans/disburse',

  // ── KYC ──
  /** POST: Submit KYC documents. Auth required. Body: { aadhaar_number, pan_number } */
  KYC_SUBMIT: '/kyc/submit',
  /** GET: Check KYC verification status. Auth required. */
  KYC_STATUS: '/kyc/status',

  // ── Credit ──
  /** GET: Get credit score. Auth required. */
  CREDIT_SCORE: '/credit/score',
  /** GET: Get CIBIL/NPCL bureau report stub. Auth required. */
  CREDIT_BUREAU: '/credit/bureau-report',

  // ── Payments (Razorpay) ──
  /** POST: Create a Razorpay plan. Auth required. Body: { frequency, amountPaise, label } */
  CREATE_PLAN: '/payments/create-plan',
  /** POST: Create a subscription/mandate. Auth required. Body: { planId, totalCycles, method, amount, frequency, loanId? } */
  CREATE_SUBSCRIPTION: '/payments/create-subscription',
  /** POST: Verify Razorpay payment signature. Auth required. Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } */
  VERIFY_PAYMENT: '/payments/verify',
  /** GET: List user's mandates. Auth required. */
  MANDATES: '/payments/mandates',
  /** POST: Cancel a mandate. Auth required. Body: { mandate_id } */
  CANCEL_MANDATE: '/payments/cancel-mandate',
  /** POST: Pause an active mandate. Auth required. Body: { mandate_id } */
  PAUSE_MANDATE: '/payments/pause-mandate',
  /** POST: Resume a paused mandate. Auth required. Body: { mandate_id } */
  RESUME_MANDATE: '/payments/resume-mandate',
  /** GET: Transaction history. Auth required. */
  TRANSACTIONS: '/payments/transactions',

  // ── Health ──
  /** GET: Server health check. Public. */
  HEALTH: '/health',

  // ── Admin Loan Review ──
  /** GET: Full loan review data (credit check, risk, documents, approvals). Admin. */
  LOAN_REVIEW: (id: number) => `/admin/loans/${id}/review`,
  /** POST: Initiate credit check. Admin. */
  LOAN_CREDIT_CHECK: (id: number) => `/admin/loans/${id}/review/credit-check`,
  /** POST: Complete credit check step. Body: { status, notes? } */
  LOAN_CREDIT_CHECK_COMPLETE: (id: number) => `/admin/loans/${id}/review/credit-check/complete`,
  /** POST: Perform risk assessment. Admin. */
  LOAN_RISK_ASSESSMENT: (id: number) => `/admin/loans/${id}/review/risk-assessment`,
  /** POST: Complete risk assessment step. Body: { status, notes? } */
  LOAN_RISK_ASSESSMENT_COMPLETE: (id: number) => `/admin/loans/${id}/review/risk-assessment/complete`,
  /** GET: Get document validation status. Admin. */
  LOAN_DOCUMENTS: (id: number) => `/admin/loans/${id}/review/documents`,
  /** POST: Verify/reject a document. Body: { doc_type, status, notes? } */
  LOAN_DOCUMENT_VERIFY: (id: number) => `/admin/loans/${id}/review/documents/verify`,
  /** POST: Final approval (tiered). Body: { notes? } */
  LOAN_APPROVE: (id: number) => `/admin/loans/${id}/review/approve`,
  /** POST: Reject loan at any step. Body: { reason, step? } */
  LOAN_REJECT: (id: number) => `/admin/loans/${id}/review/reject`,
  /** GET: List reviewers with approval limits. Admin. */
  LOAN_REVIEWERS: '/admin/loan-reviewers',
  /** GET: Enriched loan list with review status. Admin. Query: ?status= */
  ADMIN_LOANS: '/admin/loans',

  // ── Admin Notifications ──
  /** GET: List notification templates. Admin auth required. Query: ?channel=sms&active=true */
  NOTIFICATION_TEMPLATES: '/admin/notifications/templates',
  /** POST: Create notification template. Admin auth required. Body: { name, label, channel, subject?, body, variables? } */
  NOTIFICATION_TEMPLATES_CREATE: '/admin/notifications/templates',
  /** PUT: Update notification template. Admin auth required. Path param: id */
  NOTIFICATION_TEMPLATES_UPDATE: (id: number) => `/admin/notifications/templates/${id}`,
  /** POST: Send notification broadcast. Admin auth required. Body: { template_id?, title?, message, channels, target_roles?, kyc_status?, min_trust_score?, scheduled_for? } */
  NOTIFICATION_BROADCAST: '/admin/notifications/broadcast',
  /** GET: Get broadcast history with analytics. Admin auth required. Query: ?status=&channel=&limit=&offset= */
  NOTIFICATION_BROADCASTS: '/admin/notifications/broadcasts',
  /** POST: Cancel a broadcast. Admin auth required. Path param: id */
  NOTIFICATION_BROADCAST_CANCEL: (id: number) => `/admin/notifications/broadcasts/${id}/cancel`,
  /** GET: Get aggregate delivery analytics. Admin auth required. */
  NOTIFICATION_ANALYTICS: '/admin/notifications/analytics',

  // ── Admin API Management ──
  /** GET: List API keys. Admin auth required. Query: ?service_name=&status=&environment= */
  API_KEYS: '/admin/api-keys',
  /** POST: Create API key. Admin auth required. Body: { service_name, key_label, environment?, notes? } */
  API_KEYS_CREATE: '/admin/api-keys',
  /** POST: Rotate API key. Admin auth required. Path param: id */
  API_KEYS_ROTATE: (id: number) => `/admin/api-keys/${id}/rotate`,
  /** POST: Revoke API key. Admin auth required. Path param: id */
  API_KEYS_REVOKE: (id: number) => `/admin/api-keys/${id}/revoke`,
  /** GET: Webhook event logs. Admin auth required. Query: ?provider=&status=&event_type=&page=&limit= */
  WEBHOOK_LOGS: '/admin/webhooks/logs',
  /** GET: Webhook analytics. Admin auth required. */
  WEBHOOK_ANALYTICS: '/admin/webhooks/analytics',
  /** POST: Replay a webhook event. Admin auth required. Path param: id */
  WEBHOOK_REPLAY: (id: number) => `/admin/webhooks/logs/${id}/replay`,
  /** GET: Service health status + uptime. Admin auth required. */
  SERVICES_HEALTH: '/admin/services/health',
  /** GET: Health history for a service. Admin auth required. Path param: name. Query: ?hours=24 */
  SERVICE_HEALTH_HISTORY: (name: string) => `/admin/services/${name}/health-history`,
  /** POST: Run health check for a service. Admin auth required. Path param: name */
  SERVICE_CHECK: (name: string) => `/admin/services/${name}/check`,
  /** POST: Run all health checks. Admin auth required. */
  SERVICES_CHECK_ALL: '/admin/services/check-all',
  /** GET: List integration configs. Admin auth required. */
  INTEGRATIONS: '/admin/integrations',
  /** POST: Upsert integration config. Admin auth required. Body: { service_name, display_name?, base_url?, config?, is_enabled?, feature_flags? } */
  INTEGRATION_UPSERT: '/admin/integrations',
  /** POST: Toggle integration. Admin auth required. Path param: name. Body: { is_enabled } */
  INTEGRATION_TOGGLE: (name: string) => `/admin/integrations/${name}/toggle`,

  // ── Loan Offers ──
  /** GET: List user's loan offers. Auth required. Query: ?status= */
  LOAN_OFFERS: '/offers',
  /** POST: Accept a loan offer. Auth required. Body: { offer_id } */
  LOAN_OFFER_ACCEPT: '/offers/accept',
  /** POST: Reject a loan offer. Auth required. Body: { offer_id } */
  LOAN_OFFER_REJECT: '/offers/reject',

  // ── Collections ──
  /** GET: List collection logs. Agent/Admin auth. Query: ?loan_id=&status=&agent_id= */
  COLLECTION_LOGS: '/collections/logs',
  /** POST: Create a collection log entry. Agent auth. Body: CollectionLog fields */
  COLLECTION_LOG_CREATE: '/collections/logs',
  /** PUT: Update a collection log. Agent auth. Path param: id */
  COLLECTION_LOG_UPDATE: (id: number) => `/collections/logs/${id}`,

  // ── Fraud Events ──
  /** GET: List fraud events. Admin auth. Query: ?severity=&status=&type= */
  FRAUD_EVENTS: '/admin/fraud/events',
  /** POST: Update fraud event status. Admin auth. Path param: id. Body: { status, resolution? } */
  FRAUD_EVENT_UPDATE: (id: number) => `/admin/fraud/events/${id}/status`,

  // ── Admin Investor Dashboard ──
  /** GET: Portfolio summary across all investors + aggregate metrics. Admin. */
  INVESTORS_SUMMARY: '/admin/investors/summary',
  /** GET: List investors with portfolio data. Admin. Query: ?search=&kyc_status=&sort_by=&limit=&offset= */
  INVESTORS: '/admin/investors',
  /** GET: Detailed portfolio breakdown for a single investor. Admin. Path param: id */
  INVESTOR_DETAIL: (id: number) => `/admin/investors/detail/${id}`,
  /** GET: List fund allocation requests. Admin. Query: ?status=&investor_id=&type= */
  ALLOCATION_REQUESTS: '/admin/investors/allocation-requests',
  /** POST: Approve fund allocation request. Admin. Path param: id */
  ALLOCATION_APPROVE: (id: number) => `/admin/investors/allocation-requests/${id}/approve`,
  /** POST: Reject fund allocation request. Admin. Path param: id. Body: { reason } */
  ALLOCATION_REJECT: (id: number) => `/admin/investors/allocation-requests/${id}/reject`,
  /** POST: Execute approved allocation request. Admin. Path param: id */
  ALLOCATION_EXECUTE: (id: number) => `/admin/investors/allocation-requests/${id}/execute`,
  /** POST: Add internal note to investor. Admin. Path param: id. Body: { note } */
  INVESTOR_NOTE: (id: number) => `/admin/investors/${id}/notes`,
  /** GET: AUM trend data. Admin. Query: ?days=30 */
  AUM_TREND: '/admin/investors/aum-trend',
} as const;
