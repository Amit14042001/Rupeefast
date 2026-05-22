/**
 * RupeeFast — Webhook Worker
 *
 * Processes Razorpay webhook events from the Bull queue:
 *   - subscription.activated
 *   - subscription.charged
 *   - subscription.pending / halted / completed
 *
 * Provides idempotency, structured logging, audit trail, and error handling.
 *
 * Start with:
 *   require('./workers/webhook-worker').start(db, redis);
 */

const logger = require('../logger');
const sentry = require('../sentry');
const audit = require('../audit');
const metrics = require('../metrics');
const razorpay = require('../razorpay');
const { getQueue, addJob } = require('./queue');

/**
 * Start the webhook worker — registers a processor on the 'webhook' queue.
 * @param {object} db - Database instance
 * @param {object} redis - Redis client wrapper
 */
function start(db, redis) {
  const queue = getQueue('webhook');
  if (!queue) {
    logger.warn('Webhook worker not started — queue unavailable');
    return;
  }

  queue.process(async (job) => {
    const { event, rawBody, webhookId } = job.data;

    logger.info({ jobId: job.id, event: event?.event, webhookId }, 'Webhook worker processing job');

    // Idempotency check
    if (webhookId) {
      const alreadyProcessed = await isProcessed(webhookId, redis);
      if (alreadyProcessed) {
        logger.info({ webhookId }, 'Duplicate webhook — skipping (idempotency)');
        return { status: 'skipped', reason: 'duplicate' };
      }
    }

    return await processWebhookEvent(db, event, webhookId);
  });

  logger.info('Webhook worker registered on queue');
}

/**
 * Submit a webhook event to the queue for processing.
 * @param {object} params
 * @param {object} params.event - Parsed webhook event
 * @param {string} params.rawBody - Raw JSON string
 * @param {string} [params.webhookId] - Provider event ID (for dedup)
 * @param {number} [params.delay] - Processing delay in ms
 * @returns {Promise<Bull.Job|null>}
 */
async function enqueueWebhookEvent({ event, rawBody, webhookId, delay }) {
  return await addJob('webhook', event.event || 'unknown', { event, rawBody, webhookId }, { delay });
}

/**
 * Process a single webhook event.
 */
async function processWebhookEvent(db, event, webhookId) {
  metrics.webhooksReceived.inc(event.event);

  try {
    switch (event.event) {
      case 'subscription.activated':
        await db.run(
          `UPDATE payment_mandates SET status = $1, activated_at = CURRENT_TIMESTAMP WHERE razorpay_subscription_id = $2`,
          ['active', event.payload.subscription.entity.id]
        );
        break;

      case 'subscription.charged': {
        const payment = event.payload.payment.entity;
        const subId = event.payload.subscription.entity.id;
        const mandate = await db.get('SELECT user_id, method FROM payment_mandates WHERE razorpay_subscription_id = $1', [subId]);
        await db.run(
          `INSERT INTO transactions (user_id, loan_id, razorpay_payment_id, razorpay_subscription_id, amount, type, status, method, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [mandate?.user_id || 0, null, payment.id, subId, payment.amount / 100, 'repayment', 'completed', mandate?.method || 'upi_autopay', JSON.stringify(payment)]
        );
        await db.run(
          `UPDATE payment_mandates SET remaining_cycles = GREATEST(remaining_cycles - 1, 0) WHERE razorpay_subscription_id = $1 AND remaining_cycles > 0`,
          [subId]
        );
        audit.log({
          userId: mandate?.user_id || null, action: 'payment.mandate.charge', resourceType: 'payment_mandate', resourceId: subId,
          metadata: { payment_id: payment.id, amount_paise: payment.amount, method: mandate?.method || 'unknown', webhook_id: webhookId },
          ipAddress: 'queue-worker',
        }).catch(() => {});
        break;
      }

      case 'subscription.pending':
        await db.run(`UPDATE payment_mandates SET status = $1 WHERE razorpay_subscription_id = $2`, ['pending', event.payload.subscription.entity.id]);
        break;

      case 'subscription.halted':
        await db.run(`UPDATE payment_mandates SET status = $1 WHERE razorpay_subscription_id = $2`, ['halted', event.payload.subscription.entity.id]);
        break;

      case 'subscription.completed':
        await db.run(`UPDATE payment_mandates SET status = $1, remaining_cycles = $2 WHERE razorpay_subscription_id = $3`, ['completed', 0, event.payload.subscription.entity.id]);
        break;

      default:
        logger.info({ event: event.event }, 'Unhandled webhook event');
    }

    return { status: 'processed', event: event.event };
  } catch (err) {
    logger.error({ err: err.message, event: event?.event }, 'Webhook processing error');
    metrics.errorsTotal.inc('webhook');
    sentry.captureError(err, { route: 'webhook-worker', event: event?.event });
    throw err; // Let Bull handle retry
  }
}

/**
 * Check if a webhook ID has already been processed (idempotency).
 */
async function isProcessed(webhookId, redis) {
  if (!webhookId) return false;
  if (redis.getStatus().connected) {
    try {
      const exists = await redis.get(`wh:processed:${webhookId}`);
      if (exists) return true;
      await redis.setex(`wh:processed:${webhookId}`, 86400, '1');
      return false;
    } catch (err) {
      logger.warn({ err: err.message, webhookId }, 'Redis dedup check failed');
    }
  }
  return false;
}

module.exports = { start, enqueueWebhookEvent, processWebhookEvent };
