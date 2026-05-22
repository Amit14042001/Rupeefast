/**
 * RupeeFast — KYC Service
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { KycSubmitResponse, KycStatusResponse } from '../types';

/**
 * Submit KYC documents for verification.
 */
export async function submitKyc(
  aadhaarNumber: string,
  panNumber: string,
): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  kycId?: number;
  error?: string;
}> {
  const result = await apiFetch<KycSubmitResponse>(ENDPOINTS.KYC_SUBMIT, {
    method: 'POST',
    body: { aadhaar_number: aadhaarNumber, pan_number: panNumber },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    status: result.data.status,
    message: result.data.message,
    kycId: result.data.kyc_id,
  };
}

/**
 * Check current KYC verification status.
 */
export async function getKycStatus(): Promise<{
  status: 'pending' | 'verified' | 'rejected' | 'none';
  message?: string;
}> {
  const result = await apiFetch<KycStatusResponse>(ENDPOINTS.KYC_STATUS);

  if (!result.success || !result.data.kyc) {
    return { status: 'none' };
  }

  return { status: result.data.kyc.status };
}
