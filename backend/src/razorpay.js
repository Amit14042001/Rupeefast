const Razorpay = require('razorpay');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Razorpay client instance.
 * Configure via environment variables:
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET
 */
function getClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    logger.warn('Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    return null;
  }

  return new Razorpay({ key_id, key_secret });
}

/**
 * Create a recurring payment plan.
 * @param {string} frequency - 'daily', 'weekly', 'monthly'
 * @param {number} amountPaise - Amount in paise (e.g., ₹120 = 12000)
 * @param {string} label - Human-readable plan name
 * @returns {Promise<object>} Razorpay plan object
 */
async function createPlan(frequency, amountPaise, label) {
  const client = getClient();
  if (!client) return null;

  // Razorpay plan periods: daily, weekly, monthly, yearly
  const periodMap = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };
  const period = periodMap[frequency] || 'daily';

  const plan = await client.plans.create({
    period,
    interval: 1,
    item: {
      name: label || `RupeeFast EMI — ${frequency}`,
      amount: amountPaise,
      currency: 'INR',
      description: `RupeeFast recurring ${frequency} payment`
    }
  });

  logger.info({ plan_id: plan.id }, 'Razorpay plan created');
  return plan;
}

/**
 * Create a subscription for a customer.
 * @param {string} planId - Razorpay plan ID
 * @param {number} totalCycles - Total number of payment cycles (e.g., 100 for daily 100-day loan)
 * @param {object} notes - Additional notes (e.g., { user_id, loan_id })
 * @returns {Promise<object>} Razorpay subscription object
 */
async function createSubscription(planId, totalCycles, notes = {}) {
  const client = getClient();
  if (!client) return null;

  const subscription = await client.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    quantity: 1,
    total_count: totalCycles,
    expire_by: Math.floor(Date.now() / 1000) + (365 * 24 * 3600), // Expire in 1 year
    notes
  });

  logger.info({ subscription_id: subscription.id, status: subscription.status }, 'Razorpay subscription created');
  return subscription;
}

/**
 * Verify a Razorpay payment signature (used after checkout).
 * @param {string} orderId - Razorpay order ID (for one-time) or subscription_id (for recurring)
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Signature from Razorpay Checkout response
 * @returns {boolean} Whether signature is valid
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}

/**
 * Verify subscription payment signature.
 * For subscriptions, the signature is generated differently.
 */
function verifySubscriptionSignature(subscriptionId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${subscriptionId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}

/**
 * Verify incoming webhook signature.
 * @param {string} body - Raw request body as string
 * @param {string} signature - Value of x-razorpay-signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expected === signature;
}

/**
 * Get subscription details by ID.
 */
async function fetchSubscription(subscriptionId) {
  const client = getClient();
  if (!client) return null;

  return await client.subscriptions.fetch(subscriptionId);
}

/**
 * Cancel a subscription by ID.
 */
async function cancelSubscription(subscriptionId) {
  const client = getClient();
  if (!client) return null;

  return await client.subscriptions.cancel(subscriptionId);
}

/**
 * Pause a subscription (temporarily stop charges).
 */
async function pauseSubscription(subscriptionId, pauseAt = 'now') {
  const client = getClient();
  if (!client) return null;

  return await client.subscriptions.pause(subscriptionId, { pause_at: pauseAt });
}

/**
 * Resume a paused subscription.
 */
async function resumeSubscription(subscriptionId) {
  const client = getClient();
  if (!client) return null;

  return await client.subscriptions.resume(subscriptionId);
}

module.exports = {
  getClient,
  createPlan,
  createSubscription,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
  fetchSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription
};
