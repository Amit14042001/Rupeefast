/**
 * RupeeFast — Loan Review Service
 *
 * Orchestrates the multi-step loan approval workflow:
 *   1. Credit Check   — Analyze bureau report, payment history, existing debt
 *   2. Risk Assessment — Calculate risk score from multi-dimensional factors
 *   3. Document Validation — Verify submitted documents
 *   4. Final Approval  — Tiered approval based on admin seniority & loan amount
 *
 * Each step produces a structured result that is stored in the loan_reviews
 * table and exposed via the admin API.
 */

const logger = require('./logger');
const sentry = require('./sentry');

// ── Constants ──

const APPROVAL_LIMITS = {
  1: 5000,    // Junior Admin: up to ₹5,000
  2: 15000,   // Senior Admin: up to ₹15,000
  3: 50000,   // Super Admin: up to ₹50,000
  4: 200000,  // Operations Head: up to ₹2,00,000
  5: 999999,  // Director/CEO: unlimited
};

const RISK_WEIGHTS = {
  creditScore: 0.30,
  repaymentHistory: 0.25,
  incomeStability: 0.15,
  existingDebt: 0.10,
  kycCompleteness: 0.10,
  accountAge: 0.05,
  documentQuality: 0.05,
};

// ── 1. CREDIT CHECK ──

/**
 * Perform a detailed credit check for a borrower.
 *
 * @param {object} db - Database instance
 * @param {number} userId - Borrower's user ID
 * @param {number} loanId - Loan ID
 * @returns {Promise<object>} Credit check result
 */
async function performCreditCheck(db, userId, loanId) {
  try {
    // Fetch credit score
    const creditScore = await db.get(
      'SELECT * FROM credit_scores WHERE user_id = $1',
      [userId]
    );

    // Fetch bureau report (if stored)
    const bureauData = creditScore?.bureau_data
      ? JSON.parse(creditScore.bureau_data)
      : null;

    // Fetch borrower's existing/past loans
    const existingLoans = await db.all(
      'SELECT * FROM loans WHERE borrower_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    // Fetch borrower's repayment history across all loans
    const repayments = await db.all(
      `SELECT r.* FROM repayments r
       JOIN loans l ON r.loan_id = l.id
       WHERE l.borrower_id = $1
       ORDER BY r.due_date DESC
       LIMIT 100`,
      [userId]
    );

    // Calculate repayment metrics
    const totalPaid = repayments.filter(r => r.status === 'paid' || r.paid === true).length;
    const totalDue = repayments.length;
    const onTimeCount = repayments.filter(r => {
      if (!r.paid_at && r.status !== 'paid' && r.paid !== true) return false;
      const dueDate = new Date(r.due_date);
      const paidDate = new Date(r.paid_at || r.created_at);
      return paidDate <= dueDate || (paidDate - dueDate) < 3 * 24 * 60 * 60 * 1000; // within 3 days
    }).length;

    const repaymentRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
    const onTimeRate = totalDue > 0 ? (onTimeCount / totalDue) * 100 : 100;

    // Calculate existing debt
    const activeLoans = existingLoans.filter(l => l.status === 'active' || l.status === 'disbursed');
    const totalExistingDebt = activeLoans.reduce((sum, l) => sum + Number(l.remaining_balance || l.amount || 0), 0);

    // Determine credit score category
    const score = creditScore?.score || 600;
    let creditCategory;
    let creditRemarks;

    if (score >= 750) {
      creditCategory = 'excellent';
      creditRemarks = 'Excellent credit history — low risk borrower';
    } else if (score >= 650) {
      creditCategory = 'good';
      creditRemarks = 'Good credit history with minor concerns';
    } else if (score >= 500) {
      creditCategory = 'fair';
      creditRemarks = 'Fair credit history — requires additional scrutiny';
    } else if (score >= 300) {
      creditCategory = 'poor';
      creditRemarks = 'Poor credit history — high risk, consider rejection';
    } else {
      creditCategory = 'very_poor';
      creditRemarks = 'Very poor/insufficient credit history — not recommended';
    }

    const result = {
      creditScore: score,
      creditCategory,
      creditRemarks,
      bureauReport: bureauData ? {
        totalAccounts: bureauData.total_accounts || 0,
        activeAccounts: bureauData.active_accounts || 0,
        delinquentAccounts: bureauData.delinquent_accounts || 0,
        inquiries6Months: bureauData.inquiries_last_6_months || 0,
        creditUtilizationPct: bureauData.credit_utilization_pct || 0,
      } : null,
      repaymentHistory: {
        totalLoans: existingLoans.length,
        activeLoans: activeLoans.length,
        completedLoans: existingLoans.filter(l => l.status === 'completed').length,
        defaultedLoans: existingLoans.filter(l => l.status === 'defaulted').length,
        totalRepayments: totalDue,
        paidRepayments: totalPaid,
        onTimeRate: Math.round(onTimeRate),
        repaymentRate: Math.round(repaymentRate),
      },
      existingDebt: totalExistingDebt,
      creditUtilization: totalExistingDebt > 0
        ? Math.round((totalExistingDebt / (score * 100)) * 100)
        : 0,
      passed: score >= 300 && repaymentRate >= 60,
    };

    return result;
  } catch (err) {
    sentry.captureError(err, { userId, loanId, service: 'loan-review/performCreditCheck' });
    throw err;
  }
}

// ── 2. RISK ASSESSMENT ──

/**
 * Calculate a multi-dimensional risk assessment for a loan application.
 *
 * @param {object} db - Database instance
 * @param {number} userId - Borrower's user ID
 * @param {object} loan - Loan object (from DB)
 * @param {object} creditCheck - Result from performCreditCheck()
 * @returns {Promise<object>} Risk assessment result
 */
async function performRiskAssessment(db, userId, loan, creditCheck) {
  try {
    // Fetch user details
    const user = await db.get('SELECT * FROM users WHERE id = $1', [userId]);

    // Fetch KYC records
    const kyc = await db.get('SELECT * FROM kyc_records WHERE user_id = $1', [userId]);

    // Fetch any agent/field verification data
    const agentTasks = await db.all(
      'SELECT * FROM agent_tasks WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    // ── Calculate individual risk factors ──

    // Factor 1: Credit Score Risk (0-100, lower is riskier)
    const creditScoreRisk = creditCheck.creditScore >= 750 ? 10
      : creditCheck.creditScore >= 650 ? 30
      : creditCheck.creditScore >= 500 ? 55
      : creditCheck.creditScore >= 300 ? 75
      : 95;

    // Factor 2: Repayment History Risk
    const repaymentRisk = creditCheck.repaymentHistory.repaymentRate >= 95 ? 5
      : creditCheck.repaymentHistory.repaymentRate >= 80 ? 20
      : creditCheck.repaymentHistory.repaymentRate >= 60 ? 45
      : creditCheck.repaymentHistory.repaymentRate >= 40 ? 70
      : 90;

    // Factor 3: Income Stability (inferred from trust score + loan amount)
    const trustScore = user?.trust_score || 50;
    const loanAmount = Number(loan?.amount || 0);
    const incomeRisk = trustScore >= 80 ? 10
      : trustScore >= 60 ? 30
      : trustScore >= 40 ? 50
      : trustScore >= 20 ? 70
      : 90;

    // Factor 4: Existing Debt Burden
    const debtBurdenRatio = creditCheck.existingDebt > 0
      ? Math.min(100, (creditCheck.existingDebt / Math.max(loanAmount, 1)) * 50)
      : 0;
    const debtRisk = debtBurdenRatio;

    // Factor 5: KYC Completeness
    const kycRisk = (!kyc || kyc.status !== 'verified') ? 80
      : kyc.status === 'verified' ? 5
      : 50;

    // Factor 6: Account Age (new users are riskier)
    const accountAgeDays = user?.created_at
      ? Math.max(1, (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 1;
    const ageRisk = accountAgeDays >= 365 ? 5
      : accountAgeDays >= 180 ? 20
      : accountAgeDays >= 60 ? 40
      : accountAgeDays >= 14 ? 60
      : 85;

    // Factor 7: Amount Reasonableness
    const amountRisk = loanAmount > 50000 ? 70
      : loanAmount > 25000 ? 50
      : loanAmount > 10000 ? 30
      : loanAmount > 5000 ? 15
      : 10;

    // ── Aggregate weighted risk score (0-100, lower = better) ──
    const weightedRisk =
      creditScoreRisk * RISK_WEIGHTS.creditScore +
      repaymentRisk * RISK_WEIGHTS.repaymentHistory +
      incomeRisk * RISK_WEIGHTS.incomeStability +
      debtRisk * RISK_WEIGHTS.existingDebt +
      kycRisk * RISK_WEIGHTS.kycCompleteness +
      ageRisk * RISK_WEIGHTS.accountAge +
      amountRisk * RISK_WEIGHTS.documentQuality;

    // Convert to 0-100 score where higher = better (safer)
    const riskScore = Math.round(Math.max(0, 100 - weightedRisk));
    const riskLevel = riskScore >= 80 ? 'very_low'
      : riskScore >= 60 ? 'low'
      : riskScore >= 40 ? 'moderate'
      : riskScore >= 20 ? 'high'
      : 'critical';

    const riskFactors = [
      {
        factor: 'Credit Score',
        risk: creditScoreRisk,
        weight: RISK_WEIGHTS.creditScore,
        detail: `Score ${creditCheck.creditScore}/900 — ${creditCheck.creditCategory}`,
      },
      {
        factor: 'Repayment History',
        risk: repaymentRisk,
        weight: RISK_WEIGHTS.repaymentHistory,
        detail: `${creditCheck.repaymentHistory.onTimeRate}% on-time, ${creditCheck.repaymentHistory.repaymentRate}% repaid`,
      },
      {
        factor: 'Income Stability',
        risk: incomeRisk,
        weight: RISK_WEIGHTS.incomeStability,
        detail: `Trust score: ${trustScore}/100`,
      },
      {
        factor: 'Existing Debt',
        risk: debtRisk,
        weight: RISK_WEIGHTS.existingDebt,
        detail: `₹${creditCheck.existingDebt.toLocaleString('en-IN')} existing debt`,
      },
      {
        factor: 'KYC Completeness',
        risk: kycRisk,
        weight: RISK_WEIGHTS.kycCompleteness,
        detail: !kyc ? 'Not submitted' : `${kyc.status}`,
      },
      {
        factor: 'Account Age',
        risk: ageRisk,
        weight: RISK_WEIGHTS.accountAge,
        detail: `${Math.round(accountAgeDays)} days since registration`,
      },
      {
        factor: 'Loan Amount',
        risk: amountRisk,
        weight: RISK_WEIGHTS.documentQuality,
        detail: `₹${loanAmount.toLocaleString('en-IN')} requested`,
      },
    ];

    // Recommendations
    const recommendations = [];
    if (creditCheck.creditScore < 500) recommendations.push('Request additional collateral or guarantor');
    if (creditCheck.repaymentHistory.onTimeRate < 70) recommendations.push('Require auto-pay mandate setup before disbursement');
    if (!kyc || kyc.status !== 'verified') recommendations.push('Complete KYC verification before proceeding');
    if (loanAmount > trustScore * 150) recommendations.push('Loan amount is high relative to trust score — consider a lower amount');
    if (accountAgeDays < 30) recommendations.push('New user — recommend field verification by an agent');
    if (debtBurdenRatio > 40) recommendations.push('High existing debt burden — verify repayment capacity');
    if (riskScore >= 60) recommendations.push('Standard processing — low risk');
    if (recommendations.length === 0) recommendations.push('No special concerns — proceed with standard processing');

    const result = {
      riskScore,
      riskLevel,
      weightedRisk: Math.round(weightedRisk),
      riskFactors,
      recommendations,
      details: {
        trustScore,
        accountAgeDays: Math.round(accountAgeDays),
        kycStatus: kyc?.status || 'not_submitted',
        agentVerificationCount: agentTasks.filter(t => t.status === 'completed').length,
      },
      passed: riskScore >= 35 && !riskFactors.some(f => f.risk >= 90),
    };

    return result;
  } catch (err) {
    sentry.captureError(err, { userId, loanId, service: 'loan-review/performRiskAssessment' });
    throw err;
  }
}

// ── 3. DOCUMENT VALIDATION ──

/**
 * Validate all required documents for a loan application.
 *
 * Required documents depend on loan amount:
 *   < ₹10,000: Aadhaar + PAN
 *   ₹10k–₹25k: Aadhaar + PAN + Photo
 *   > ₹25k: Aadhaar + PAN + Photo + Bank Statement + Income Proof
 *
 * @param {object} db - Database instance
 * @param {number} userId - Borrower's user ID
 * @param {number} loanId - Loan ID
 * @param {number} loanAmount - Requested loan amount
 * @returns {Promise<object>} Document validation result
 */
async function validateDocuments(db, userId, loanId, loanAmount) {
  try {
    // Determine required docs based on loan amount
    const requiredDocs = ['aadhaar', 'pan'];
    if (loanAmount >= 10000) requiredDocs.push('photo');
    if (loanAmount >= 15000) requiredDocs.push('bank_statement');
    if (loanAmount >= 25000) requiredDocs.push('income_proof');
    if (loanAmount >= 50000) requiredDocs.push('address_proof');

    // Fetch existing loan documents
    const existingDocs = await db.all(
      'SELECT * FROM loan_documents WHERE loan_id = $1',
      [loanId]
    );

    // Also check KYC records for Aadhaar/PAN
    const kyc = await db.get('SELECT * FROM kyc_records WHERE user_id = $1', [userId]);

    // Build document statuses
    const documents = requiredDocs.map(docType => {
      const existing = existingDocs.find(d => d.doc_type === docType);

      // Auto-populate Aadhaar and PAN from KYC
      if (docType === 'aadhaar' && kyc?.aadhaar_number && !existing) {
        return {
          doc_type: 'aadhaar',
          status: 'verified',
          notes: 'Auto-verified from KYC submission',
          submittedAt: kyc.created_at,
        };
      }
      if (docType === 'pan' && kyc?.pan_number && !existing) {
        return {
          doc_type: 'pan',
          status: 'verified',
          notes: 'Auto-verified from KYC submission',
          submittedAt: kyc.created_at,
        };
      }

      if (existing) {
        return {
          doc_type: existing.doc_type,
          status: existing.status,
          notes: existing.notes,
          verifiedBy: existing.verified_by,
          verifiedAt: existing.verified_at,
          submittedAt: existing.created_at,
        };
      }

      // Check if KYC was submitted — Aadhaar/PAN were provided
      if ((docType === 'aadhaar' || docType === 'pan') && kyc) {
        return {
          doc_type: docType,
          status: 'pending',
          notes: 'Provided during KYC — awaiting admin verification',
          submittedAt: kyc.created_at,
        };
      }

      return {
        doc_type: docType,
        status: 'not_submitted',
        notes: 'Not yet uploaded by borrower',
        submittedAt: null,
      };
    });

    // Auto-insert Aadhaar/PAN from KYC if not already recorded
    if (kyc?.aadhaar_number) {
      const hasAadhaarDoc = existingDocs.some(d => d.doc_type === 'aadhaar');
      if (!hasAadhaarDoc) {
        try {
          await db.run(
            `INSERT INTO loan_documents (loan_id, user_id, doc_type, doc_url, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [loanId, userId, 'aadhaar', null, 'verified', 'Auto-verified from KYC submission']
          );
        } catch (e) {
          // Non-critical — doc is still considered verified
        }
      }
    }
    if (kyc?.pan_number) {
      const hasPanDoc = existingDocs.some(d => d.doc_type === 'pan');
      if (!hasPanDoc) {
        try {
          await db.run(
            `INSERT INTO loan_documents (loan_id, user_id, doc_type, doc_url, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [loanId, userId, 'pan', null, 'verified', 'Auto-verified from KYC submission']
          );
        } catch (e) {
          // Non-critical
        }
      }
    }

    const allVerified = documents.every(d => d.status === 'verified');
    const missingCount = documents.filter(d => d.status === 'not_submitted' || d.status === 'rejected').length;
    const pendingCount = documents.filter(d => d.status === 'pending').length;

    const result = {
      documents,
      summary: {
        required: requiredDocs.length,
        verified: documents.filter(d => d.status === 'verified').length,
        pending: pendingCount,
        missing: missingCount,
        rejected: documents.filter(d => d.status === 'rejected').length,
      },
      passed: allVerified,
      allVerified,
    };

    return result;
  } catch (err) {
    sentry.captureError(err, { userId, loanId, service: 'loan-review/validateDocuments' });
    throw err;
  }
}

// ── 4. TIERED APPROVAL CHECK ──

/**
 * Check whether an admin has sufficient authority to approve a loan.
 *
 * @param {object} db - Database instance
 * @param {number} adminUserId - Admin's user ID
 * @param {number} loanAmount - Requested loan amount
 * @returns {Promise<object>} Approval authority result
 */
async function checkApprovalAuthority(db, adminUserId, loanAmount) {
  try {
    const adminRole = await db.get(
      'SELECT * FROM admin_roles WHERE user_id = $1',
      [adminUserId]
    );

    // If no explicit admin role, check user role
    const user = await db.get('SELECT * FROM users WHERE id = $1', [adminUserId]);

    const roleLevel = adminRole?.role_level || 1;
    const approvalLimit = adminRole?.approval_limit || APPROVAL_LIMITS[roleLevel] || APPROVAL_LIMITS[1];
    const canApprove = adminRole?.can_approve !== false;
    const canDisburse = adminRole?.can_disburse === true;
    const canOverride = adminRole?.can_override === true;

    const isWithinLimit = Number(loanAmount) <= Number(approvalLimit);
    const needsHigherApproval = !isWithinLimit && !canOverride;

    return {
      roleLevel,
      title: adminRole?.title || 'Admin',
      approvalLimit: Number(approvalLimit),
      canApprove,
      canDisburse,
      canOverride,
      isWithinLimit,
      needsHigherApproval,
      loanAmount: Number(loanAmount),
      // If needs higher approval, suggest the next level
      requiredLevel: needsHigherApproval
        ? Object.entries(APPROVAL_LIMITS).find(([level, limit]) => Number(limit) >= Number(loanAmount))?.[0] || '5'
        : null,
    };
  } catch (err) {
    sentry.captureError(err, { adminUserId, loanAmount, service: 'loan-review/checkApprovalAuthority' });
    throw err;
  }
}

// ── 5. FULL REVIEW EXECUTION ──

/**
 * Execute or fetch all steps of a loan review.
 *
 * @param {object} db - Database instance
 * @param {number} loanId - Loan ID
 * @returns {Promise<object>} Complete review state
 */
async function getFullReview(db, loanId) {
  try {
    const loan = await db.get('SELECT * FROM loans WHERE id = $1', [loanId]);
    if (!loan) throw new Error('Loan not found');

    const borrower = await db.get('SELECT * FROM users WHERE id = $1', [loan.borrower_id]);

    // Get all review steps
    const reviewSteps = await db.all(
      'SELECT * FROM loan_reviews WHERE loan_id = $1 ORDER BY step',
      [loanId]
    );

    const steps = {
      credit_check: reviewSteps.find(s => s.step === 'credit_check') || null,
      risk_assessment: reviewSteps.find(s => s.step === 'risk_assessment') || null,
      document_validation: reviewSteps.find(s => s.step === 'document_validation') || null,
      final_approval: reviewSteps.find(s => s.step === 'final_approval') || null,
    };

    // Parse out metadata
    const enriched = {};
    for (const [key, step] of Object.entries(steps)) {
      if (step) {
        enriched[key] = {
          ...step,
          metadata: typeof step.metadata === 'string' ? JSON.parse(step.metadata) : (step.metadata || {}),
        };
      } else {
        enriched[key] = null;
      }
    }

    return {
      loan,
      borrower,
      steps: enriched,
      allStepsComplete: Object.values(enriched).every(s => s && s.status === 'passed'),
      currentStep: loan.status, // 'applied', 'credit_check', etc.
    };
  } catch (err) {
    sentry.captureError(err, { loanId, service: 'loan-review/getFullReview' });
    throw err;
  }
}

// ── 6. COMPLETE A REVIEW STEP ──

/**
 * Complete a review step with a passed/failed status.
 * Also updates the loan status to advance to the next step.
 *
 * @param {object} db - Database instance
 * @param {number} loanId - Loan ID
 * @param {string} step - Step name
 * @param {string} status - 'passed' | 'failed' | 'skipped'
 * @param {number} reviewerId - Admin user ID
 * @param {string} notes - Reviewer notes
 * @param {object} metadata - Step-specific result data
 * @returns {Promise<object>} Updated step & loan status
 */
async function completeReviewStep(db, loanId, step, status, reviewerId, notes, metadata = {}) {
  try {
    // Upsert the review step
    const existing = await db.get(
      'SELECT * FROM loan_reviews WHERE loan_id = $1 AND step = $2',
      [loanId, step]
    );

    if (existing) {
      await db.run(
        `UPDATE loan_reviews SET status = $1, reviewer_id = $2, notes = $3,
         metadata = $4, completed_at = CASE WHEN $1 IN ('passed','failed','skipped') THEN CURRENT_TIMESTAMP ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [status, reviewerId, notes, JSON.stringify(metadata), existing.id]
      );
    } else {
      await db.run(
        `INSERT INTO loan_reviews (loan_id, step, status, reviewer_id, notes, metadata, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $3 IN ('passed','failed','skipped') THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        [loanId, step, status, reviewerId, notes, JSON.stringify(metadata)]
      );
    }

    // Update loan status based on review step completion
    if (status === 'passed' || status === 'skipped') {
      const nextStatus = getNextLoanStatus(step);
      if (nextStatus) {
        await db.run('UPDATE loans SET status = $1 WHERE id = $2', [nextStatus, loanId]);
      }
    } else if (status === 'failed') {
      // Mark loan as rejected
      await db.run('UPDATE loans SET status = $1 WHERE id = $2', ['rejected', loanId]);
    }

    // Return updated review data
    const updated = await db.get(
      'SELECT * FROM loan_reviews WHERE loan_id = $1 AND step = $2',
      [loanId, step]
    );

    return {
      step: {
        ...updated,
        metadata: typeof updated.metadata === 'string' ? JSON.parse(updated.metadata) : (updated.metadata || {}),
      },
      loanStatus: status === 'failed' ? 'rejected' : getNextLoanStatus(step) || 'applied',
    };
  } catch (err) {
    sentry.captureError(err, { loanId, step, reviewerId, service: 'loan-review/completeReviewStep' });
    throw err;
  }
}

/**
 * Map a review step to the next loan status.
 */
function getNextLoanStatus(step) {
  const map = {
    credit_check: 'risk_assessment',
    risk_assessment: 'document_validation',
    document_validation: 'approved',
    final_approval: null, // stays 'approved' — manual disbursement triggers 'disbursed'
  };
  return map[step] || null;
}

// ── 7. LIST APPROVED REVIEWERS ──

/**
 * List all admin staff with their approval limits and current assignment counts.
 */
async function getReviewers(db) {
  try {
    const reviewers = await db.all(`
      SELECT
        ar.*,
        u.name,
        u.mobile,
        COUNT(lr.id) FILTER (WHERE lr.status = 'pending' OR lr.status = 'in_progress') as active_reviews,
        COUNT(lr.id) FILTER (WHERE lr.status = 'passed') as completed_reviews
      FROM admin_roles ar
      JOIN users u ON u.id = ar.user_id
      LEFT JOIN loan_reviews lr ON lr.reviewer_id = ar.user_id
      GROUP BY ar.id, u.name, u.mobile
      ORDER BY ar.role_level DESC
    `);

    return reviewers;
  } catch (err) {
    sentry.captureError(err, { service: 'loan-review/getReviewers' });
    throw err;
  }
}

// ── 8. ADMIN LOAN LIST WITH REVIEW STATUS ──

/**
 * Get a complete list of all loans for admin, enriched with current review step status.
 */
async function getAdminLoans(db, filterStatus) {
  try {
    let sql = `
      SELECT
        l.*,
        u.name as borrower_name,
        u.mobile as borrower_mobile,
        u.trust_score,
        COALESCE(cs.score, 0) as credit_score,
        COUNT(lr.id) FILTER (WHERE lr.status = 'passed') as review_steps_passed,
        COUNT(lr.id) as total_review_steps,
        CASE
          WHEN l.status = 'applied' AND NOT EXISTS (SELECT 1 FROM loan_reviews WHERE loan_id = l.id AND step = 'credit_check')
            THEN 'credit_check'
          WHEN l.status = 'credit_check' OR (EXISTS (SELECT 1 FROM loan_reviews WHERE loan_id = l.id AND step = 'credit_check' AND status = 'passed') AND l.status NOT IN ('approved','rejected','disbursed','active','completed','defaulted'))
            THEN 'risk_assessment'
          WHEN l.status = 'risk_assessment' OR (EXISTS (SELECT 1 FROM loan_reviews WHERE loan_id = l.id AND step = 'risk_assessment' AND status = 'passed') AND l.status NOT IN ('approved','rejected','disbursed','active','completed','defaulted'))
            THEN 'document_validation'
          WHEN l.status = 'document_validation' OR (EXISTS (SELECT 1 FROM loan_reviews WHERE loan_id = l.id AND step = 'document_validation' AND status = 'passed') AND l.status NOT IN ('approved','rejected','disbursed','active','completed','defaulted'))
            THEN 'final_approval'
          ELSE l.status
        END as current_review_step
      FROM loans l
      JOIN users u ON u.id = l.borrower_id
      LEFT JOIN credit_scores cs ON cs.user_id = l.borrower_id
      LEFT JOIN loan_reviews lr ON lr.loan_id = l.id
    `;

    const params = [];
    if (filterStatus && filterStatus !== 'all' && filterStatus !== 'review') {
      params.push(filterStatus);
      sql += ` WHERE l.status = $1`;
    } else if (filterStatus === 'review') {
      params.push('applied', 'credit_check', 'risk_assessment', 'document_validation');
      sql += ` WHERE l.status IN ($1, $2, $3, $4)`;
    }

    sql += ` GROUP BY l.id, u.name, u.mobile, u.trust_score, cs.score ORDER BY l.created_at DESC`;

    const loans = await db.all(sql, params);
    return loans;
  } catch (err) {
    sentry.captureError(err, { filterStatus, service: 'loan-review/getAdminLoans' });
    throw err;
  }
}

module.exports = {
  performCreditCheck,
  performRiskAssessment,
  validateDocuments,
  checkApprovalAuthority,
  getFullReview,
  completeReviewStep,
  getReviewers,
  getAdminLoans,
  APPROVAL_LIMITS,
};
