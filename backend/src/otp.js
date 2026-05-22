/**
 * RupeeFast OTP Service
 *
 * Production-grade OTP generation and verification with:
 *   - Cryptographically secure random 6-digit OTPs
 *   - OTP hashing (SHA-256) before storage — never store plaintext
 *   - TTL-based expiry (default 5 minutes)
 *   - Single-use tokens (invalidated after verify)
 *   - Rate limiting: max N sends per phone per window, max M verify attempts
 *   - Redis-backed storage with in-memory Map fallback
 *
 * Usage:
 *   const otp = require('./otp');
 *   await otp.send(mobile);           // Generates & stores OTP, returns masked mobile
 *   const ok = await otp.verify(mobile, code);  // Returns true/false
 *
 * The actual OTP value is never returned to the caller — only stored hashed.
 * In production, the OTP is sent via SMS gateway (Twilio, MSG91, etc.).
 */

const crypto = require('crypto');
const logger = require('./logger');
const redis = require('./redis');

// ── Configuration ──

const OTP_LENGTH = 6;                // 6-digit OTP
const OTP_TTL_SECONDS = 300;         // 5 minutes
const MAX_SENDS_PER_WINDOW = 3;      // Max OTP sends per phone number
const SEND_WINDOW_SECONDS = 900;     // 15 minutes
const MAX_VERIFY_ATTEMPTS = 5;       // Max verify attempts before lockout
const VERIFY_WINDOW_SECONDS = 900;   // 15 minutes

// ── In-memory fallback storage (used when Redis is unavailable) ──

const memStore = new Map();          // key -> { hash, ttl }

// Interval to clean expired entries from memory store
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore) {
    if (entry.expiresAt <= now) memStore.delete(key);
  }
}, 60_000).unref();

// ── Helpers ──

function otpKey(mobile) {
  return `otp:hash:${mobile}`;
}

function sendCountKey(mobile) {
  return `otp:send_count:${mobile}`;
}

function verifyCountKey(mobile) {
  return `otp:verify_count:${mobile}`;
}

/**
 * Generate a cryptographically secure random N-digit OTP string.
 */
function generateOTP(length = OTP_LENGTH) {
  const max = Math.pow(10, length);
  const randomBytes = crypto.randomBytes(4); // 32 bits
  const randomInt = randomBytes.readUInt32BE(0);
  const otp = (randomInt % max).toString().padStart(length, '0');
  return otp;
}

/**
 * Hash the OTP with a random salt using SHA-256.
 * Returns `${salt}:${hash}` — the salt is stored alongside the hash.
 */
function hashOTP(otp) {
  const salt = crypto.randomBytes(8).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + otp).digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify an OTP against a stored hash.
 */
function verifyHash(otp, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto.createHash('sha256').update(salt + otp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
}

// ── In-memory fallback implementations ──

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  memStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memDel(key) {
  memStore.delete(key);
}

function memIncr(key, ttlSeconds) {
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    memStore.set(key, {
      value: '1',
      expiresAt: now + ttlSeconds * 1000,
    });
    return 1;
  }
  const count = parseInt(entry.value, 10) + 1;
  entry.value = String(count);
  return count;
}

// ── Public API ──

/**
 * Generate and store an OTP for the given mobile number.
 * Returns an object with masked mobile for display.
 *
 * In production, this would also trigger an SMS via Twilio/MSG91/etc.
 *
 * @param {string} mobile - Indian mobile number (10 digits)
 * @returns {Promise<{success: boolean, maskedMobile: string, message: string}>}
 */
async function send(mobile) {
  // Check rate limit for OTP sends
  const sendCount = await redis.getStatus().connected
    ? await redis.incr(sendCountKey(mobile), SEND_WINDOW_SECONDS)
    : memIncr(sendCountKey(mobile), SEND_WINDOW_SECONDS);

  if (sendCount > MAX_SENDS_PER_WINDOW) {
    logger.warn({ mobile: maskMobile(mobile) }, 'OTP send rate limit exceeded');
    return {
      success: false,
      maskedMobile: maskMobile(mobile),
      message: `Too many OTP requests. Please try again after ${SEND_WINDOW_SECONDS / 60} minutes.`,
    };
  }

  const otp = generateOTP();
  const hashed = hashOTP(otp);

  // Store hashed OTP with TTL
  if (redis.getStatus().connected) {
    await redis.setex(otpKey(mobile), OTP_TTL_SECONDS, hashed);
  } else {
    memSet(otpKey(mobile), hashed, OTP_TTL_SECONDS);
  }

  // Reset verify count when a new OTP is sent
  if (redis.getStatus().connected) {
    await redis.del(verifyCountKey(mobile));
  } else {
    memDel(verifyCountKey(mobile));
  }

  logger.info(
    { mobile: maskMobile(mobile), expiresIn: `${OTP_TTL_SECONDS}s` },
    'OTP generated and stored',
  );

  // ── IMPORTANT: In production, send OTP via SMS gateway here ──
  // For development/demo, log the OTP so developers can test
  if (process.env.NODE_ENV !== 'production') {
    logger.debug({ mobile, otp }, 'DEV OTP — do not log in production');
  }

  return {
    success: true,
    maskedMobile: maskMobile(mobile),
    message: `OTP sent to ${maskMobile(mobile)}. Expires in ${OTP_TTL_SECONDS / 60} minutes.`,
  };
}

/**
 * Verify an OTP for the given mobile number.
 * Invalidates the OTP after successful verification (single-use).
 * Rate-limits verify attempts to prevent brute force.
 *
 * @param {string} mobile - Indian mobile number
 * @param {string} code - The OTP code entered by the user
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function verify(mobile, code) {
  // Check verify rate limit
  const attemptCount = await redis.getStatus().connected
    ? await redis.incr(verifyCountKey(mobile), VERIFY_WINDOW_SECONDS)
    : memIncr(verifyCountKey(mobile), VERIFY_WINDOW_SECONDS);

  if (attemptCount > MAX_VERIFY_ATTEMPTS) {
    logger.warn({ mobile: maskMobile(mobile) }, 'OTP verify rate limit exceeded');
    return {
      success: false,
      message: 'Too many verification attempts. Please request a new OTP.',
    };
  }

  // Retrieve stored hash
  const storedHash = await redis.getStatus().connected
    ? await redis.get(otpKey(mobile))
    : memGet(otpKey(mobile));

  if (!storedHash) {
    return {
      success: false,
      message: 'OTP expired or not requested. Please request a new OTP.',
    };
  }

  // Verify using timing-safe comparison
  const isValid = verifyHash(code, storedHash);

  if (!isValid) {
    logger.warn(
      { mobile: maskMobile(mobile), attempt: attemptCount },
      'OTP verification failed — invalid code',
    );
    return {
      success: false,
      message: 'Invalid OTP. Please try again.',
    };
  }

  // ── Invalidate OTP (single-use) ──
  if (redis.getStatus().connected) {
    await redis.del(otpKey(mobile));
    await redis.del(verifyCountKey(mobile));
  } else {
    memDel(otpKey(mobile));
    memDel(verifyCountKey(mobile));
  }

  logger.info({ mobile: maskMobile(mobile) }, 'OTP verified successfully');
  return { success: true, message: 'OTP verified successfully' };
}

/**
 * Mask a mobile number for logging: 9876543210 → 98****10
 */
function maskMobile(mobile) {
  if (!mobile || mobile.length < 6) return mobile || 'unknown';
  return mobile.slice(0, 2) + '****' + mobile.slice(-2);
}

module.exports = { send, verify, generateOTP, maskMobile };
