/**
 * RupeeFast — Payment Service
 *
 * Reusable Razorpay integration layer extracted from the pay screen.
 * Provides:
 *   - Razorpay Checkout HTML builder (WebView-compatible)
 *   - Plan & subscription creation on the backend
 *   - Payment signature verification
 *   - Mandate lifecycle management (cancel, pause, activate)
 *   - Message parsing for Razorpay WebView postMessage events
 *
 * Usage:
 *   import { buildRazorpayCheckoutHtml, verifyRazorpayPayment, createRazorpayPlan } from '../services/payments';
 */

import { apiFetch } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { TransactionsResponse } from '../types';

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

/** Options for building the Razorpay Checkout HTML page */
export interface RazorpayCheckoutOptions {
  /** Razorpay API key ID (rzp_...) */
  key: string;
  /** Amount in paise (₹1 = 100 paise) */
  amountPaise: number;
  /** Merchant display name (shown in Razorpay modal) */
  name: string;
  /** Description shown to the user */
  description: string;
  /** Optional subscription_id for recurring mandates */
  subscriptionId?: string;
  /** Prefilled contact number */
  prefillContact?: string;
  /** Prefilled customer name */
  prefillName?: string;
  /** Hex colour for the Razorpay theme (default: #1B3A6B) */
  themeColor?: string;
}

/** Successful Razorpay payment response */
export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

/** Message posted from the Razorpay WebView via postMessage */
export interface RazorpayMessage {
  type: 'SUCCESS' | 'DISMISSED';
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
}

/** Request body for /payments/create-plan */
export interface CreatePlanRequest {
  frequency: 'daily' | 'weekly' | 'monthly';
  amountPaise: number;
  label: string;
}

/** Request body for /payments/create-subscription */
export interface CreateSubscriptionRequest {
  planId: string;
  totalCycles: number;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  method: string;
}

/** Request body for /payments/verify */
export interface PaymentVerificationRequest {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

/** Result of a plan creation call */
export interface PlanCreateResult {
  planId: string;
}

/** Result of a subscription creation call */
export interface SubscriptionCreateResult {
  subscriptionId: string;
}

// ══════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════

/**
 * Razorpay key from the environment.
 * Exposed to the client bundle via the EXPO_PUBLIC_ prefix.
 */
export const RAZORPAY_KEY_ID: string =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_xxxxxxxxxxxx';

/**
 * Returns true when a real (non-placeholder) Razorpay key is configured.
 * The placeholder `rzp_test_xxxxxxxxxxxx` triggers demo mode.
 */
export function isRazorpayConfigured(): boolean {
  return !!RAZORPAY_KEY_ID && !RAZORPAY_KEY_ID.includes('test_xxxxxxxxxxxx');
}

// ══════════════════════════════════════════════════
// HTML CHECKOUT BUILDER
// ══════════════════════════════════════════════════

/**
 * Build the inline HTML string for Razorpay Checkout inside a WebView.
 *
 * The HTML loads Razorpay's checkout.js, opens the modal automatically,
 * and posts the result back to React Native via
 * `window.ReactNativeWebView.postMessage()`.
 *
 * Messages follow the {@link RazorpayMessage} format:
 * - `{ type: 'SUCCESS', razorpay_payment_id, razorpay_subscription_id, razorpay_signature }`
 * - `{ type: 'DISMISSED' }` — user closed the modal
 */
export function buildRazorpayCheckoutHtml(
  options: RazorpayCheckoutOptions,
): string {
  const {
    key,
    amountPaise,
    name,
    description,
    subscriptionId,
    prefillContact,
    prefillName,
    themeColor = '#1B3A6B',
  } = options;

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;padding:0;background:#0F1117;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:20px;font-family:sans-serif;">
    <div style="font-size:14px;color:#9CA3AF;margin-bottom:20px;">Loading RupeeFast Payment...</div>
    <div style="width:40px;height:40px;border:3px solid #1B3A6B;border-top-color:transparent;border-radius:50%;margin:0 auto;animation:spin 0.8s linear infinite;"></div>
  </div>
  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  <script>
    var rzp = new Razorpay({
      key: '${key}',
      amount: ${amountPaise},
      currency: 'INR',
      name: '${name}',
      description: '${description}',
      ${subscriptionId ? `subscription_id: '${subscriptionId}',` : ''}
      prefill: {
        contact: '${prefillContact || ''}',
        name: '${prefillName || ''}'
      },
      theme: { color: '${themeColor}' },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SUCCESS',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_subscription_id: response.razorpay_subscription_id || '',
          razorpay_signature: response.razorpay_signature || ''
        }));
      },
      modal: {
        ondismiss: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISSED' }));
        }
      }
    });
    rzp.open();
  </script>
</body>
</html>`;
}

// ══════════════════════════════════════════════════
// PLAN & SUBSCRIPTION CREATION
// ══════════════════════════════════════════════════

/**
 * Create a recurring payment plan on the backend.
 *
 * @param frequency - Billing frequency (daily / weekly / monthly)
 * @param amountPaise - Amount per cycle in paise
 * @param label - Human-readable label for the plan
 * @returns The Razorpay plan ID, or null on failure
 */
export async function createRazorpayPlan(
  frequency: CreatePlanRequest['frequency'],
  amountPaise: number,
  label: string,
): Promise<PlanCreateResult | null> {
  const result = await apiFetch('/payments/create-plan', {
    method: 'POST',
    body: { frequency, amountPaise, label } satisfies CreatePlanRequest,
  });

  if (!result.success) return null;

  const planId = (result as any).data?.plan?.id as string | undefined;
  return planId ? { planId } : null;
}

/**
 * Create a subscription from a Razorpay plan.
 *
 * @param planId - The Razorpay plan ID
 * @param totalCycles - Total number of billing cycles
 * @param amount - Amount per cycle in rupees
 * @param frequency - Billing frequency (daily / weekly / monthly)
 * @param method - Payment method identifier (e.g. 'upi_autopay', 'nach')
 * @returns The Razorpay subscription ID, or null on failure
 */
export async function createRazorpaySubscription(
  planId: string,
  totalCycles: number,
  amount: number,
  frequency: CreateSubscriptionRequest['frequency'],
  method: string,
): Promise<SubscriptionCreateResult | null> {
  const result = await apiFetch('/payments/create-subscription', {
    method: 'POST',
    body: {
      planId,
      totalCycles,
      amount,
      frequency,
      method,
    } satisfies CreateSubscriptionRequest,
  });

  if (!result.success) return null;

  const subId = (result as any).data?.subscription?.id as string | undefined;
  return subId ? { subscriptionId: subId } : null;
}

// ══════════════════════════════════════════════════
// PAYMENT VERIFICATION
// ══════════════════════════════════════════════════

/**
 * Verify a Razorpay payment signature on the backend.
 *
 * The backend uses `razorpay.validatePaymentVerification()` to check
 * the signature, preventing tampering of the payment response.
 *
 * @param payload - The payment details to verify
 * @returns true when the signature is valid
 */
export async function verifyRazorpayPayment(
  payload: PaymentVerificationRequest,
): Promise<boolean> {
  const result = await apiFetch(ENDPOINTS.VERIFY_PAYMENT, {
    method: 'POST',
    body: payload satisfies PaymentVerificationRequest,
  });

  return result.success;
}

// ══════════════════════════════════════════════════
// MANDATE LIFECYCLE
// ══════════════════════════════════════════════════

/**
 * Cancel an active mandate.
 *
 * @param mandateId - The subscription / mandate ID
 * @returns true if cancellation succeeded
 */
export async function cancelMandate(mandateId: number): Promise<boolean> {
  const result = await apiFetch(ENDPOINTS.CANCEL_MANDATE, {
    method: 'POST',
    body: { mandate_id: mandateId },
  });
  return result.success;
}

/**
 * Pause an active mandate (stop collecting future payments).
 *
 * @param mandateId - The subscription / mandate ID
 * @returns true if the pause succeeded
 */
export async function pauseMandate(mandateId: number): Promise<boolean> {
  const result = await apiFetch(ENDPOINTS.PAUSE_MANDATE, {
    method: 'POST',
    body: { mandate_id: mandateId },
  });
  return result.success;
}

/**
 * Reactivate a paused mandate.
 *
 * @param mandateId - The subscription / mandate ID
 * @returns true if activation succeeded
 */
export async function activateMandate(mandateId: number): Promise<boolean> {
  const result = await apiFetch(ENDPOINTS.RESUME_MANDATE, {
    method: 'POST',
    body: { mandate_id: mandateId },
  });
  return result.success;
}

// ══════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════

/**
 * Fetch transaction history for the current user.
 */
export async function fetchTransactions(): Promise<TransactionsResponse['transactions']> {
  const result = await apiFetch<TransactionsResponse>(ENDPOINTS.TRANSACTIONS);
  if (!result.success) return [];
  return result.data?.transactions ?? [];
}

// ══════════════════════════════════════════════════
// WEBVIEW MESSAGE PARSING
// ══════════════════════════════════════════════════

/**
 * Parse a JSON message received from the Razorpay WebView.
 *
 * Safely handles malformed JSON and returns null for invalid messages.
 *
 * @param raw - The raw string from event.nativeEvent.data
 * @returns Parsed RazorpayMessage or null
 */
export function parseRazorpayMessage(raw: string): RazorpayMessage | null {
  try {
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.type === 'SUCCESS' || parsed.type === 'DISMISSED')
    ) {
      return parsed as RazorpayMessage;
    }

    return null;
  } catch {
    return null;
  }
}
