/**
 * RupeeFast — Auth Service
 *
 * Shared auth primitives extracted from the monolithic server.js:
 *   - generateToken: JWT creation with jti for revocation
 *   - upsertUser: create-or-fetch user by mobile
 *   - authMiddleware: Express middleware for JWT verification + blacklist check
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../logger');
const metrics = require('../metrics');
const sentry = require('../sentry');

/**
 * Create a factory that returns authMiddleware bound to runtime dependencies.
 *
 * @param {object} deps
 * @param {string} deps.jwtSecret
 * @param {string} deps.jwtExpiry
 * @param {object} deps.db - Database instance
 * @param {object} deps.redis - Redis client wrapper
 */
function createAuthMiddleware({ jwtSecret, jwtExpiry, db, redis }) {
  /**
   * Generate a JWT for a given user.
   */
  function generateToken(user) {
    return jwt.sign(
      { id: user.id, mobile: user.mobile, role: user.role, jti: crypto.randomUUID() },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );
  }

  /**
   * Upsert user by mobile number — creates if not exists, returns existing if found.
   */
  async function upsertUser(mobile, role) {
    let user = await db.get('SELECT * FROM users WHERE mobile = $1', [mobile]);
    if (!user) {
      const result = await db.run(
        'INSERT INTO users (mobile, role) VALUES ($1, $2) RETURNING id',
        [mobile, role || 'borrower']
      );
      user = { id: result.lastID, mobile, role: role || 'borrower' };
      metrics.usersCreated.inc();
    }
    return user;
  }

  /**
   * JWT Authentication Middleware
   * Extracts and verifies the Bearer token from the Authorization header.
   * Checks token blacklist to reject revoked tokens.
   */
  function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, jwtSecret);

      // Check if token has been revoked (blacklisted)
      if (decoded.jti) {
        const blacklistKey = `token:blacklist:${decoded.jti}`;

        // Check Redis first
        if (redis.getStatus().connected) {
          redis.get(blacklistKey).then((revoked) => {
            if (revoked) {
              return res.status(401).json({ error: 'Token has been revoked' });
            }
            req.user = decoded;
            next();
          }).catch(() => {
            // Redis error — fall through on blacklist check failure
            req.user = decoded;
            next();
          });
          return;
        }

        // Fall back to DB check
        if (db) {
          db.get('SELECT id FROM token_blacklist WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP', [decoded.jti])
            .then((row) => {
              if (row) {
                return res.status(401).json({ error: 'Token has been revoked' });
              }
              req.user = decoded;
              next();
            })
            .catch(() => {
              req.user = decoded;
              next();
            });
          return;
        }
      }

      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return { generateToken, upsertUser, authMiddleware };
}

module.exports = { createAuthMiddleware };
