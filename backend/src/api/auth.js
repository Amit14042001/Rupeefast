/**
 * RupeeFast — Auth API Routes
 *
 * POST /send-otp           — Generate & send OTP
 * POST /verify-otp         — Verify OTP & return JWT
 * POST /logout             — Revoke current JWT
 * POST /login              — Mock login (dev only, ALLOW_MOCK_OTP)
 */

const { validate, schemas } = require('../validation');
const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');
const otp = require('../otp');

/**
 * Register auth routes on the given Router.
 * @param {object} router - Express Router
 * @param {object} ctx - Context { db, redis, metrics, generateToken, upsertUser, authMiddleware, ALLOW_MOCK_OTP }
 */
module.exports = function (router, ctx) {
  const { redis, metrics, generateToken, upsertUser, authMiddleware, ALLOW_MOCK_OTP } = ctx;

  // 1A. Send OTP
  router.post('/send-otp', validate(schemas.login), async (req, res) => {
    const { mobile, role } = req.body;
    try {
      const result = await otp.send(mobile);
      if (!result.success) {
        return res.status(429).json({ error: result.message });
      }
      audit.log({
        userId: null, action: 'auth.otp.send', resourceType: 'user', resourceId: mobile,
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      }).catch(() => {});
      res.json({ success: true, masked_mobile: result.maskedMobile, message: result.message });
    } catch (err) {
      sentry.captureError(err, { route: 'auth/send-otp' });
      res.status(500).json({ error: err.message });
    }
  });

  // 1B. Verify OTP
  router.post('/verify-otp', validate(schemas.verifyOtp), async (req, res) => {
    const { mobile, otp: otpCode } = req.body;
    try {
      let otpValid = false;
      if (ALLOW_MOCK_OTP && process.env.NODE_ENV !== 'production') {
        otpValid = true;
        logger.debug({ mobile: otp.maskMobile(mobile) }, 'Dev mode: mock OTP accepted');
      } else {
        const verifyResult = await otp.verify(mobile, otpCode);
        otpValid = verifyResult.success;
      }
      if (!otpValid) {
        return res.status(401).json({ error: 'Invalid or expired OTP' });
      }
      const user = await upsertUser(mobile, req.body.role);
      const token = generateToken(user);
      audit.log({
        userId: user.id, action: 'auth.otp.verify', resourceType: 'user', resourceId: user.id,
        metadata: { role: user.role, isNewUser: !user.name },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: user.role,
      }).catch(() => {});
      res.json({
        success: true,
        user: { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
        token,
        message: 'OTP verified successfully',
      });
    } catch (err) {
      sentry.captureError(err, { route: 'auth/verify-otp' });
      res.status(500).json({ error: err.message });
    }
  });

  // 1C. Logout
  router.post('/logout', authMiddleware, async (req, res) => {
    const { jti, id: userId } = req.user;
    if (!jti) {
      return res.json({ success: true, message: 'Logged out (token has no JTI)' });
    }
    try {
      if (redis.getStatus().connected) {
        await redis.setex(`token:blacklist:${jti}`, 7 * 24 * 3600, '1');
      }
      if (ctx.db) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await ctx.db.run(
          'INSERT INTO token_blacklist (jti, user_id, expires_at, reason) VALUES ($1, $2, $3, $4) ON CONFLICT (jti) DO NOTHING',
          [jti, userId, expiresAt, 'logout']
        );
      }
      audit.log({
        userId, action: 'auth.logout', resourceType: 'user', resourceId: userId,
        metadata: { jti }, ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      logger.warn({ userId, jti }, 'Logout token revocation failed');
      res.json({ success: true, message: 'Logged out' });
    }
  });

  // 1D. Mock login (dev only)
  router.post('/login', validate(schemas.login), async (req, res) => {
    const { mobile, role } = req.body;
    if (!ALLOW_MOCK_OTP) {
      return res.status(401).json({
        error: 'Direct login is disabled. Use POST /api/auth/send-otp → /api/auth/verify-otp instead.',
      });
    }
    try {
      const user = await upsertUser(mobile, role);
      const token = generateToken(user);
      audit.log({
        userId: user.id, action: 'auth.login', resourceType: 'user', resourceId: user.id,
        metadata: { role: user.role, mockOtp: true, isNewUser: !user.name },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: user.role,
      }).catch(() => {});
      res.json({
        success: true,
        user: { id: user.id, mobile: user.mobile, role: user.role, name: user.name },
        token,
        message: 'OTP verified successfully (mock)',
      });
    } catch (err) {
      sentry.captureError(err, { route: 'auth/login' });
      res.status(500).json({ error: err.message });
    }
  });
};
