/**
 * RupeeFast — Bull Queue Setup
 *
 * Central queue registry for all background job processing.
 * Uses Bull (Redis-backed) with graceful fallback if Redis is unavailable.
 *
 * Queues:
 *   - webhook      : Incoming Razorpay webhook event processing (dedup + side effects)
 *   - remittance   : Disburse loan funds, execute repayments, settle investor returns
 *   - score-update : Trigger credit score recalculation and bureau report refresh
 *   - collection   : Send payment reminders, escalate overdue accounts
 *   - notification : Send scheduled broadcast notifications
 *
 * Usage:
 *   const { getQueue, addJob } = require('./workers/queue');
 *   await addJob('webhook', { event: 'subscription.charged', ... }, { delay: 5000 });
 */

const Bull = require('bull');
const logger = require('../logger');

// ── Redis connection config ──
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
const REDIS_CONFIG = REDIS_URL
  ? REDIS_URL
  : { host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT, 10) || 6379 };

// ── Queue name -> options mapping ──
const QUEUE_DEFAULTS = {
  webhook:      { defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 } },
  remittance:   { defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 }, removeOnComplete: 500, removeOnFail: 100 } },
  'score-update': { defaultJobOptions: { attempts: 1, timeout: 30000, removeOnComplete: 200 } },
  collection:   { defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: 200 } },
  notification: { defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 200 } },
};

// ── Queue registry ──
const queues = new Map();
let isShuttingDown = false;

/**
 * Get or create a Bull queue by name.
 * Returns null if Redis is unavailable or queue creation fails.
 * @param {string} name - Queue name
 * @returns {Bull.Queue|null}
 */
function getQueue(name) {
  if (isShuttingDown) {
    logger.warn({ queue: name }, 'Cannot get queue during shutdown');
    return null;
  }

  if (queues.has(name)) return queues.get(name);

  try {
    const opts = QUEUE_DEFAULTS[name] || {};
    const queue = new Bull(`rupeefast:${name}`, REDIS_URL || REDIS_CONFIG, {
      ...opts,
      settings: {
        stalledInterval: 30000,
        maxStalledCount: 2,
        lockDuration: 60000,
      },
    });

    // Event logging
    queue.on('error', (err) => {
      logger.error({ err: err.message, queue: name }, 'Bull queue error');
    });

    queue.on('waiting', (jobId) => {
      logger.debug({ jobId, queue: name }, 'Job waiting');
    });

    queue.on('active', (job) => {
      logger.debug({ jobId: job.id, queue: name }, 'Job active');
    });

    queue.on('completed', (job) => {
      logger.debug({ jobId: job.id, queue: name, durationMs: Date.now() - job.timestamp }, 'Job completed');
    });

    queue.on('failed', (job, err) => {
      logger.warn({ jobId: job.id, queue: name, err: err.message, attempts: job.attemptsMade }, 'Job failed');
    });

    queue.on('stalled', (job) => {
      logger.warn({ jobId: job.id, queue: name }, 'Job stalled — will be retried');
    });

    queues.set(name, queue);
    logger.info({ queue: name }, 'Bull queue initialised');
    return queue;
  } catch (err) {
    logger.error({ err: err.message, queue: name }, 'Failed to create Bull queue');
    return null;
  }
}

/**
 * Add a job to a queue with optional delay and priority.
 * @param {string} queueName - Queue name
 * @param {string} jobName - Job type / name
 * @param {object} data - Job payload
 * @param {object} [opts] - Bull job options (delay, priority, etc.)
 * @returns {Promise<Bull.Job|null>}
 */
async function addJob(queueName, jobName, data, opts = {}) {
  const queue = getQueue(queueName);
  if (!queue) {
    logger.warn({ queue: queueName, job: jobName }, 'Queue unavailable — job not added');
    return null;
  }

  try {
    const job = await queue.add(jobName, data, {
      removeOnComplete: 100,
      removeOnFail: 50,
      ...opts,
    });
    logger.debug({ jobId: job.id, queue: queueName, job: jobName }, 'Job added to queue');
    return job;
  } catch (err) {
    logger.error({ err: err.message, queue: queueName, job: jobName }, 'Failed to add job to queue');
    return null;
  }
}

/**
 * Gracefully close all queues.
 * Called during server shutdown to allow in-flight jobs to complete.
 */
async function closeAll() {
  isShuttingDown = true;
  logger.info({ queueCount: queues.size }, 'Closing all Bull queues...');

  const closePromises = [];
  for (const [name, queue] of queues) {
    closePromises.push(
      queue.close().catch((err) => {
        logger.warn({ err: err.message, queue: name }, 'Error closing queue');
      })
    );
  }

  await Promise.all(closePromises);
  queues.clear();
  logger.info('All Bull queues closed');
}

module.exports = { getQueue, addJob, closeAll };
