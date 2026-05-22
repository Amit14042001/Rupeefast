/**
 * RupeeFast — Loans Service
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { LoanApplyResponse, LoanDisburseResponse, LoanPlan } from '../types';

/**
 * Submit a loan application.
 */
export async function applyLoan(
  amount: number,
  plan: LoanPlan,
  purpose: string,
): Promise<{ success: boolean; loanId?: number; error?: string }> {
  const result = await apiFetch<LoanApplyResponse>(ENDPOINTS.APPLY_LOAN, {
    method: 'POST',
    body: { amount, plan, purpose },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, loanId: result.data.loan_id };
}

/**
 * Disburse an approved loan (post-KYC).
 */
export async function disburseLoan(
  loanId: number,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const result = await apiFetch<LoanDisburseResponse>(ENDPOINTS.DISBURSE_LOAN, {
    method: 'POST',
    body: { loan_id: loanId },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, message: result.data.message };
}
