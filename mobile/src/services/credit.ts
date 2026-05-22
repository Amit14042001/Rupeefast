/**
 * RupeeFast — Credit Service
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { CreditScoreResponse } from '../types';

/**
 * Fetch the user's credit score.
 */
export async function fetchCreditScore(): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  const result = await apiFetch<CreditScoreResponse>(ENDPOINTS.CREDIT_SCORE);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, score: result.data.score.score };
}
