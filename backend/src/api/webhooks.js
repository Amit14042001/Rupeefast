/**
 * RupeeFast — Webhook Routes
 *
 * POST /razorpay — Receive and process Razorpay webhook events
 *   - subscription.activated
 *   - subscription.charged
 *   - subscription.pending / halted / completed
 *
 * Idempotency is handled via isWebhookProcessed from the context.
 */

const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');
const razorpay = require('../integrations/razorpay');

/**
 * Register webhook routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { metrics, isWebhookProcessed } = ctx;

  // Razorpay Webhook
  router.post('/razorpay', async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || '';
    const webhookId = req.headers['x-razorpay-webhook-id'];

    // Idempotency check
    if (webhookId) {
      const alreadyProcessed = await isWebhookProcessed(webhookId);
      if (alreadyProcessed) {
        logger.info({ webhookId }, 'Duplicate webhook received — skipping (idempotency)');
        return res.status(200).json({ status: 'ok', deduplicated: true });
      }
    }

    if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
      logger.warn({ webhookId }, 'Razorpay webhook signature verification failed');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    logger.info({ event: event.event, webhookId }, 'Razorpay webhook received');
    metrics.webhooksReceived.inc(event.event);

    try {
      switch (event.event) {
        case 'subscription.activated':
          await ctx.db.run(
            `UPDATE payment_mandates SET status = $1, activated_at = CURRENT_TIMESTAMP WHERE razorpay_subscription_id = $2`,
            ['active', event.payload.subscription.entity.id]
          );
          break;

        case 'subscription.charged': {
          const payment = event.payload.payment.entity;
          const subId = event.payload.subscription.entity.id;
          const mandate = await ctx.db.get(
            'SELECT user_id, method FROM payment_mandates WHERE razorpay_subscription_id = $1',
            [subId]
          );
          await ctx.db.run(
            `INSERT INTO transactions (user_id, loan_id, razorpay_payment_id, razorpay_subscription_id, amount, type, status, method, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [mandate?.user_id || 0, null, payment.id, subId, payment.amount / 100, 'repayment', 'completed', mandate?.method || 'upi_autopay', JSON.stringify(payment)]
          );
          await ctx.db.run(
            `UPDATE payment_mandates SET remaining_cycles = GREATEST(remaining_cycles - 1, 0) WHERE razorpay_subscription_id = $1 AND remaining_cycles > 0`,
            [subId]
          );
          audit.log({
            userId: mandate?.user_id || null, action: 'payment.mandate.charge', resourceType: 'payment_mandate', resourceId: subId,
            metadata: { payment_id: payment.id, amount_paise: payment.amount, method: mandate?.method || 'unknown', webhook_id: webhookId },
            ipAddress: req.ip,
          }).catch(() => {});
          break;
        }

        case 'subscription.pending':
          await ctx.db.run(`UPDATE payment_mandates SET status = $1 WHERE razorpay_subscription_id = $2`, ['pending', event.payload.subscription.entity.id]);
          break;

        case 'subscription.halted':
          await ctx.db.run(`UPDATE payment_mandates SET status = $1 WHERE razorpay_subscription_id = $2`, ['halted', event.payload.subscription.entity.id]);
          break;

        case 'subscription.completed':
          await ctx.db.run(`UPDATE payment_mandates SET status = $1, remaining_cycles = $2 WHERE razorpay_subscription_id = $3`, ['completed', 0, event.payload.subscription.entity.id]);
          break;

        default:
          logger.info({ event: event.event }, 'Unhandled Razorpay webhook event');
      }
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      logger.error(err, 'Webhook processing error');
      metrics.errorsTotal.inc('webhook');
      sentry.captureError(err, { route: 'webhooks/razorpay', event: event?.event });
      res.status(200).json({ status: 'error', message: err.message });
    }
  });
};
