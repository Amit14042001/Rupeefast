/**
 * RupeeFast — Loan Offers Service
 *
 * Manages pre-approved loan offers from the `loan_offers` table (migration 008).
 * Borrowers can view, accept, or reject offers within the expiry window.
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { LoanOffer, LoanOffersResponse } from '../types';

/**
 * Fetch all loan offers for the current user.
 * Optionally filter by status (pending / accepted / rejected / expired / converted).
 */
export async function fetchOffers(
  status?: string,
): Promise<LoanOffer[]> {
  const query = status ? `?status=${status}` : '';
  const result = await apiFetch<LoanOffersResponse>(
    `${ENDPOINTS.LOAN_OFFERS}${query}`,
  );

  if (!result.success) return [];
  return result.data?.offers ?? [];
}

/**
 * Accept a pre-approved loan offer and proceed to loan creation.
 * Returns the loan_id if successfully converted.
 */
export async function acceptOffer(
  offerId: number,
): Promise<{ success: boolean; loanId?: number; error?: string }> {
  const result = await apiFetch(ENDPOINTS.LOAN_OFFER_ACCEPT, {
    method: 'POST',
    body: { offer_id: offerId },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, loanId: (result as any).data?.loan_id };
}

/**
 * Reject a loan offer (permanently dismiss).
 */
export async function rejectOffer(
  offerId: number,
): Promise<{ success: boolean; error?: string }> {
  const result = await apiFetch(ENDPOINTS.LOAN_OFFER_REJECT, {
    method: 'POST',
    body: { offer_id: offerId },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}
