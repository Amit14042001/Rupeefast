/**
 * RupeeFast — Rate Limiter Service
 *
 * Factory for creating rate limiters with Redis-backed storage
 * (for cluster-aware throttling) and in-memory fallback.
 *
 * Usage:
 *   const { createRateLimiter } = require('./services/rate-limiter');
 *   const loginLimiter = createRateLimiter({ redis, prefix: 'login', windowMs: 15*60*1000, ... });
 */

const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

/**
 * Create a rate limiter middleware.
 *
 * @param {object} options
 * @param {object} options.redis - Redis client wrapper (from ./redis)
 * @param {string} [options.prefix='gen'] - Redis key prefix for store
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} [options.envLimit] - Environment variable value (overrides defaultLimit)
 * @param {number} options.defaultLimit - Default max requests per window
 * @param {string} options.message - Error message for rate-limited requests
 * @param {Function} [options.requestWasSuccessful] - Optional fn to skip counting failed reqs
 * @param {boolean} [options.skipFailedRequests] - Whether to skip counting failed status codes
 * @returns {Function} Express middleware
 */
function createRateLimiter(options) {
  const redisClient = options.redis?.getClient?.();
  const redisConnected = options.redis?.getStatus?.().connected;

  const store = redisClient && redisConnected
    ? new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${options.prefix || 'gen'}:`,
      })
    : undefined;

  return rateLimit({
    windowMs: options.windowMs,
    limit: parseInt(options.envLimit, 10) || options.defaultLimit,
    message: { error: options.message },
    standardHeaders: true,
    legacyHeaders: false,
    store,
    requestWasSuccessful: options.requestWasSuccessful,
    ...(options.skipFailedRequests ? { skipFailedRequests: true } : {}),
  });
}

module.exports = { createRateLimiter };
