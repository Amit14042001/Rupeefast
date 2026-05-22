/**
 * RupeeFast — SMS Gateway Integration
 *
 * Send transactional SMS (OTP, payment reminders, disbursement alerts) via an SMS provider.
 * Supports pluggable providers: MSG91, Twilio, AWS SNS, or custom HTTP API.
 *
 * TODO: Replace mock implementation with real SMS provider API calls.
 * Required env: SMS_PROVIDER, SMS_API_KEY, SMS_SENDER_ID
 */

const logger = require('../logger');

const PROVIDER = process.env.SMS_PROVIDER || 'stub';
const API_KEY = process.env.SMS_API_KEY || '';
const SENDER_ID = process.env.SMS_SENDER_ID || 'RUPEFAST';

/**
 * Send an SMS to a single recipient.
 * @param {string} mobile - Recipient mobile number (with country code)
 * @param {string} message - SMS text content
 * @param {object} [options] - { senderId?, dltTemplateId? }
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendSMS(mobile, message, options = {}) {
  if (!API_KEY && PROVIDER !== 'stub') {
    logger.warn('SMS gateway not configured');
    return { success: false, error: 'SMS_NOT_CONFIGURED' };
  }
  logger.info({ mobile: mobile.slice(0, 4) + '****' + mobile.slice(-2), length: message.length, provider: PROVIDER }, 'SMS stub called');
  return { success: true, messageId: `stub-${Date.now()}` };
}

/**
 * Send bulk SMS to multiple recipients.
 * @param {string[]} mobiles - Array of mobile numbers
 * @param {string} message - SMS text content
 * @param {object} [options]
 * @returns {Promise<{success: boolean, sent: number, failed: number, results?: Array, error?: string}>}
 */
async function sendBulk(mobiles, message, options = {}) {
  const results = await Promise.allSettled(mobiles.map(m => sendSMS(m, message, options)));
  const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - sent;
  return { success: failed === 0, sent, failed, results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message }) };
}

module.exports = { sendSMS, sendBulk };
