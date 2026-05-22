/**
 * RupeeFast — Firebase Cloud Messaging (Push Notifications)
 *
 * Send push notifications to Android (FCM) and iOS (APNs via FCM) devices.
 *
 * TODO: Replace mock implementation with real FCM HTTP v1 API calls.
 * Required env: FCM_SERVER_KEY or FCM_SERVICE_ACCOUNT_JSON
 */

const logger = require('../logger');

const SERVER_KEY = process.env.FCM_SERVER_KEY || '';

/**
 * Send a push notification to one or more device tokens.
 * @param {string|string[]} tokens - FCM device token(s)
 * @param {object} payload - { title, body, data?: object }
 * @returns {Promise<{success: boolean, results?: Array, error?: string}>}
 */
async function sendPush(tokens, payload) {
  if (!SERVER_KEY) {
    logger.warn('FCM not configured — skipping push notification');
    return { success: false, error: 'FCM_NOT_CONFIGURED' };
  }
  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  if (tokenList.length === 0) return { success: false, error: 'NO_TOKENS' };

  // TODO: Implement real FCM HTTP v1 API call
  logger.info({ tokenCount: tokenList.length, title: payload.title }, 'FCM push stub called');
  return { success: true, results: tokenList.map(() => ({ status: 'stub-sent' })) };
}

/**
 * Send notification to multiple devices (topic-based).
 * @param {string} topic - FCM topic name
 * @param {object} payload - { title, body, data?: object }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendToTopic(topic, payload) {
  if (!SERVER_KEY) {
    return { success: false, error: 'FCM_NOT_CONFIGURED' };
  }
  return { success: true, messageId: 'stub-topic-message-id' };
}

module.exports = { sendPush, sendToTopic };
