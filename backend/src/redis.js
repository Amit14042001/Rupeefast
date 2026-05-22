/**
 * RupeeFast Redis Client
 *
 * Provides:
 *   - Connection management with retry and health checks
 *   - Session cache for expensive DB queries (dashboard data, user profiles)
 *   - Token blacklist for JWT revocation
 *   - Distributed rate limit data for cluster-aware throttling
 *
 * Usage:
 *   const redis = require('./redis');
 *   await redis.connect();
 *   await redis.setex('user:1001:dashboard', 300, JSON.stringify(data));
 *   const cached = await redis.get('user:1001:dashboard');
 */

const IORedis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'rf:';

let client = null;
let isConnected = false;

/**
 * Create and configure the Redis client.
 * Uses connection string if REDIS_URL is set, otherwise individual config.
 */
async function connect() {
  if (client && isConnected) return;

  const opts = {
    keyPrefix: REDIS_KEY_PREFIX,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      logger.warn({ attempt: times, delay }, 'Redis connection retry');
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (REDIS_PASSWORD) {
    opts.password = REDIS_PASSWORD;
  }

  if (REDIS_URL) {
    client = new IORedis(REDIS_URL, opts);
  } else {
    client = new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      ...opts,
    });
  }

  client.on('connect', () => {
    logger.info('Redis connecting...');
  });

  client.on('ready', () => {
    isConnected = true;
    logger.info('Redis connected.');
  });

  client.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed.');
  });

  client.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis error');
    isConnected = false;
  });

  client.on('reconnecting', (delay) => {
    logger.info({ delay }, 'Redis reconnecting...');
  });

  return client;
}

/**
 * Check if Redis is connected and responsive.
 */
async function ping() {
  if (!client || !isConnected) return false;
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Get a value by key.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function get(key) {
  if (!client || !isConnected) return null;
  try {
    return await client.get(key);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis GET failed');
    return null;
  }
}

/**
 * Set a value with optional TTL (seconds).
 * @param {string} key
 * @param {string} value
 * @param {number} [ttl] - Time to live in seconds
 */
async function set(key, value, ttl) {
  if (!client || !isConnected) return;
  try {
    if (ttl) {
      await client.setex(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis SET failed');
  }
}

/**
 * Set a key with TTL (seconds). Alias for set(key, value, ttl).
 * @param {string} key
 * @param {number} ttl - Seconds
 * @param {string} value
 */
async function setex(key, ttl, value) {
  return set(key, value, ttl);
}

/**
 * Delete one or more keys.
 * @param  {...string} keys
 */
async function del(...keys) {
  if (!client || !isConnected) return 0;
  try {
    return await client.del(keys);
  } catch (err) {
    logger.error({ err: err.message, keys }, 'Redis DEL failed');
    return 0;
  }
}

/**
 * Increment a key and set TTL on first creation (for rate limiting).
 * @param {string} key
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<number>} Current count after increment
 */
async function incr(key, ttl) {
  if (!client || !isConnected) return 0;
  try {
    const count = await client.incr(key);
    if (count === 1 && ttl) {
      await client.expire(key, ttl);
    }
    return count;
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis INCR failed');
    return 0;
  }
}

/**
 * Check TTL of a key.
 * @param {string} key
 * @returns {Promise<number>} TTL in seconds (-1 = no expiry, -2 = key missing)
 */
async function ttl(key) {
  if (!client || !isConnected) return -2;
  try {
    return await client.ttl(key);
  } catch {
    return -2;
  }
}

/**
 * Set a field in a hash.
 * @param {string} key
 * @param {string} field
 * @param {string} value
 */
async function hset(key, field, value) {
  if (!client || !isConnected) return;
  try {
    await client.hset(key, field, value);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis HSET failed');
  }
}

/**
 * Get a field from a hash.
 * @param {string} key
 * @param {string} field
 * @returns {Promise<string|null>}
 */
async function hget(key, field) {
  if (!client || !isConnected) return null;
  try {
    return await client.hget(key, field);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis HGET failed');
    return null;
  }
}

/**
 * Add member(s) to a sorted set with scores.
 * @param {string} key
 * @param {Array<{score: number, value: string}>} members
 */
async function zadd(key, members) {
  if (!client || !isConnected) return;
  try {
    const args = [];
    for (const m of members) {
      args.push(m.score, m.value);
    }
    await client.zadd(key, ...args);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis ZADD failed');
  }
}

/**
 * Query members from a sorted set by score range.
 * @param {string} key
 * @param {number} min - Minimum score (inclusive)
 * @param {number} max - Maximum score (inclusive)
 * @returns {Promise<string[]>}
 */
async function zrangebyscore(key, min, max) {
  if (!client || !isConnected) return [];
  try {
    return await client.zrangebyscore(key, min, max);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis ZRANGEBYSCORE failed');
    return [];
  }
}

/**
 * Remove member(s) from a sorted set.
 * @param {string} key
 * @param  {...string} members
 */
async function zrem(key, ...members) {
  if (!client || !isConnected) return;
  try {
    await client.zrem(key, ...members);
  } catch (err) {
    logger.error({ err: err.message, key }, 'Redis ZREM failed');
  }
}

/**
 * Gracefully close the Redis connection.
 */
async function close() {
  if (client) {
    try {
      await client.quit();
      isConnected = false;
      logger.info('Redis connection closed gracefully.');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing Redis');
    }
  }
}

/**
 * Get the underlying ioredis client (for advanced usage).
 */
function getClient() {
  return client;
}

/**
 * Check connectivity status.
 */
function getStatus() {
  return { connected: isConnected, host: REDIS_HOST, port: REDIS_PORT };
}

module.exports = {
  connect,
  close,
  ping,
  get,
  set,
  setex,
  del,
  incr,
  ttl,
  hset,
  hget,
  zadd,
  zrangebyscore,
  zrem,
  getClient,
  getStatus,
};
