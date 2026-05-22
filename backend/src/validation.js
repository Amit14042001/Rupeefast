/**
 * RupeeFast Zod Validation Schemas & Middleware
 *
 * Centralizes all request body validation using Zod schemas.
 * Provides a `validate(schema)` middleware that:
 *   1. Validates req.body against the Zod schema
 *   2. Returns 400 with structured error messages on failure
 *   3. Replaces req.body with the parsed (and transformed) result on success
 *
 * Usage:
 *   const { validate, schemas } = require('./validation');
 *   app.post('/api/auth/login', validate(schemas.login), handler);
 *
 * Each error response includes:
 *   { error: "Validation error", details: [{ field: "mobile", message: "..." }] }
 */

const { z } = require('zod');

// ── Reusable field validators ──

const mobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number');

const otpSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be a 6-digit code');

const amountSchema = z
  .number()
  .int('Amount must be a whole number')
  .min(2000, 'Minimum loan amount is ₹2,000')
  .max(50000, 'Maximum loan amount is ₹50,000');

const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits');

const panSchema = z
  .string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g., ABCDE1234F)');

// ── Role enum ──

const roleSchema = z.enum(['borrower', 'investor', 'agent', 'admin']).optional();

// ══════════════════════════════════════════════════
// SCHEMAS
// ══════════════════════════════════════════════════

const schemas = {
  // ── Auth ──
  /** POST /api/auth/login — used for initial login + OTP send */
  login: z.object({
    mobile: mobileSchema,
    role: roleSchema,
  }),

  /** POST /api/auth/verify-otp */
  verifyOtp: z.object({
    mobile: mobileSchema,
    otp: otpSchema,
  }),

  // ── Loans ──
  /** POST /api/loans/apply */
  loanApply: z.object({
    amount: amountSchema,
    plan: z.enum(['Daily', 'Weekly', 'Monthly'], {
      errorMap: () => ({ message: 'Plan must be Daily, Weekly, or Monthly' }),
    }),
    purpose: z.string().min(3, 'Purpose must be at least 3 characters').max(200),
  }),

  /** POST /api/loans/disburse */
  loanDisburse: z.object({
    loan_id: z.number().int('loan_id is required').positive(),
  }),

  // ── KYC ──
  /** POST /api/kyc/submit */
  kycSubmit: z.object({
    aadhaar_number: aadhaarSchema,
    pan_number: panSchema,
  }),

  // ── Payments ──
  /** POST /api/payments/create-plan */
  createPlan: z.object({
    frequency: z.enum(['daily', 'weekly', 'monthly'], {
      errorMap: () => ({ message: 'Frequency must be daily, weekly, or monthly' }),
    }),
    amountPaise: z.number().int('Amount must be in paise (integer)').positive(),
    label: z.string().optional(),
  }),

  /** POST /api/payments/create-subscription */
  createSubscription: z.object({
    planId: z.string().min(1, 'planId is required'),
    totalCycles: z.number().int().positive().optional(),
    method: z.enum(['upi_autopay', 'nach'], {
      errorMap: () => ({ message: 'Method must be upi_autopay or nach' }),
    }),
    amount: z.number().positive('Amount is required'),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    loanId: z.number().optional(),
  }),

  /** POST /api/payments/verify */
  verifyPayment: z.object({
    razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
    razorpay_subscription_id: z.string().min(1, 'Subscription ID is required'),
    razorpay_signature: z.string().min(1, 'Signature is required'),
    mandate_id: z.number().optional(),
  }),

  /** POST /api/payments/cancel-mandate */
  cancelMandate: z.object({
    mandate_id: z.number().int('mandate_id is required').positive(),
  }),

  /** POST /api/payments/pause-mandate */
  pauseMandate: z.object({
    mandate_id: z.number().int('mandate_id is required').positive(),
  }),

  /** POST /api/payments/resume-mandate */
  resumeMandate: z.object({
    mandate_id: z.number().int('mandate_id is required').positive(),
  }),

  // ── Loan Review / Approval Workflow ──

  /** POST /api/admin/loans/:id/review/credit-check/complete */
  reviewStepComplete: z.object({
    status: z.enum(['passed', 'failed']),
    notes: z.string().max(1000).optional(),
  }),

  /** POST /api/admin/loans/:id/review/documents/verify */
  documentVerify: z.object({
    doc_type: z.enum(['aadhaar', 'pan', 'bank_statement', 'income_proof', 'address_proof', 'photo', 'signature', 'other']),
    status: z.enum(['verified', 'rejected']),
    notes: z.string().max(1000).optional(),
  }),

  /** POST /api/admin/loans/:id/review/approve */
  loanApprove: z.object({
    notes: z.string().max(2000).optional(),
  }),

  /** POST /api/admin/loans/:id/review/reject */
  loanReject: z.object({
    reason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(2000),
    step: z.enum(['credit_check', 'risk_assessment', 'document_validation']).optional(),
  }),
};

// ══════════════════════════════════════════════════
// VALIDATION MIDDLEWARE
// ══════════════════════════════════════════════════

/**
 * Express middleware factory.
 * Validates req.body against the given Zod schema.
 *
 * On success: replaces req.body with the parsed result and calls next().
 * On failure: responds with 400 and structured error details.
 *
 * @param {z.ZodSchema} schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));

      return res.status(400).json({
        error: 'Validation error',
        details,
      });
    }

    // Replace req.body with parsed (and transformed/defaulted) data
    req.body = result.data;
    next();
  };
}

module.exports = { validate, schemas };
