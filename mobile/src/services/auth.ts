/**
 * RupeeFast — Auth Service
 *
 * Handles OTP-based authentication flow:
 *   1. Send OTP → /api/auth/send-otp
 *   2. Verify OTP → /api/auth/verify-otp
 *   3. Logout → /api/auth/logout
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { useAuthStore } from '../stores/auth-store';
import type {
  UserRole,
  SendOtpResponse,
  VerifyOtpResponse,
} from '../types';

/**
 * Send an OTP to the given mobile number.
 * In production, this triggers a real SMS.
 * Returns the masked mobile number on success.
 */
export async function sendOtp(
  mobile: string,
  role: UserRole,
): Promise<{ success: boolean; maskedMobile?: string; error?: string }> {
  const result = await apiFetch<SendOtpResponse>(ENDPOINTS.SEND_OTP, {
    method: 'POST',
    body: { mobile, role },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    maskedMobile: result.data.masked_mobile,
  };
}

/**
 * Verify the OTP and authenticate.
 * On success, stores the JWT and user in the auth store.
 * Returns user/role info for navigation.
 */
export async function verifyOtp(
  mobile: string,
  otpCode: string,
): Promise<{
  success: boolean;
  user?: { id: number; role: string };
  error?: string;
}> {
  const result = await apiFetch<VerifyOtpResponse>(ENDPOINTS.VERIFY_OTP, {
    method: 'POST',
    body: { mobile, otp: otpCode },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const { token, user } = result.data;
  useAuthStore.getState().login(token, user);

  return {
    success: true,
    user: { id: user.id, role: user.role },
  };
}

/**
 * Logout: revoke the current JWT on backend + clear local auth state.
 */
export async function logout(): Promise<void> {
  await apiFetch(ENDPOINTS.LOGOUT, { method: 'POST' });
  useAuthStore.getState().logout();
}

/**
 * Mock login for dev/offline mode — stores a demo token and navigates.
 * Call this when the backend is unreachable.
 */
export function demoLogin(mobile: string, role: UserRole) {
  const user = {
    id: Math.floor(Math.random() * 10000) + 1,
    name: 'Demo User',
    mobile,
    role,
  };
  useAuthStore.getState().login('demo-token-' + Date.now(), user);
}
