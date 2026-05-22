/**
 * RupeeFast — Webhook Deduplication Service
 *
 * Tracks processed webhook event IDs to prevent duplicate processing.
 * Uses Redis when available, falls back to an in-memory Map.
 *
 * Usage:
 *   const { createWebhookDedup } = require('./services/webhook-dedup');
 *   const { isWebhookProcessed } = createWebhookDedup(redis);
 *   if (await isWebhookProcessed(webhookId)) { return; // skip }
 */

const logger = require('../logger');

const WEBHOOK_DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Factory: returns an isWebhookProcessed function bound to a Redis instance.
 * @param {object} redis - Redis client wrapper (from ./redis)
 * @returns {{ isWebhookProcessed: Function }}
 */
function createWebhookDedup(redis) {
  // In-memory fallback store
  const processedWebhooks = new Map();

  // Periodic cleanup of stale entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processedWebhooks) {
      if (now - timestamp > WEBHOOK_DEDUP_TTL_MS) {
        processedWebhooks.delete(key);
      }
    }
  }, 60_000).unref();

  /**
   * Check if a webhook event has already been processed.
   * If not, marks it as processed with TTL.
   *
   * @param {string} webhookId - Unique event ID from the provider
   * @returns {Promise<boolean>} true if already processed, false if new
   */
  async function isWebhookProcessed(webhookId) {
    if (!webhookId) return false;

    // Check Redis first
    if (redis.getStatus().connected) {
      try {
        const exists = await redis.get(`wh:processed:${webhookId}`);
        if (exists) return true;
        // Mark as processed with TTL
        await redis.setex(`wh:processed:${webhookId}`, 86400, '1');
        return false;
      } catch (err) {
        logger.warn({ err: err.message, webhookId }, 'Redis webhook dedup check failed, falling back to in-memory');
      }
    }

    // Fall back to in-memory Map
    if (processedWebhooks.has(webhookId)) return true;
    processedWebhooks.set(webhookId, Date.now());
    return false;
  }

  return { isWebhookProcessed };
}

module.exports = { createWebhookDedup };
