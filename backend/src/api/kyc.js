/**
 * RupeeFast — KYC API Routes
 *
 * POST /submit  — Submit KYC documents (Aadhaar + PAN)
 * GET  /status  — Get KYC verification status
 */

const { validate, schemas } = require('../validation');
const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');

/**
 * Register KYC routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { metrics, authMiddleware } = ctx;

  // 13. Submit KYC documents
  router.post('/submit', authMiddleware, validate(schemas.kycSubmit), audit.middleware('kyc.submit', 'kyc_record', (req) => req.user?.id), async (req, res) => {
    const { aadhaar_number, pan_number } = req.body;
    try {
      const existing = await ctx.db.get('SELECT * FROM kyc_records WHERE user_id = $1', [req.user.id]);
      if (existing && existing.status === 'verified') {
        return res.json({ success: true, message: 'KYC already verified', kyc: existing });
      }

      const result = await ctx.db.run(
        `INSERT INTO kyc_records (user_id, aadhaar_number, pan_number, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET aadhaar_number = EXCLUDED.aadhaar_number, pan_number = EXCLUDED.pan_number, status = $4, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [req.user.id, aadhaar_number, pan_number, 'pending']
      );

      metrics.kycSubmitted.inc();

      const maskedAadhaar = aadhaar_number.slice(0, 4) + 'XXXXXXXX';
      logger.info({ userId: req.user.id, aadhaar: maskedAadhaar, panStatus: 'submitted' }, 'KYC submitted — pending verification');

      res.json({ success: true, kyc_id: result.lastID, status: 'pending', message: 'KYC submitted for verification. Our team will verify within 24 hours.' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'kyc/submit' });
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Get KYC status
  router.get('/status', authMiddleware, async (req, res) => {
    try {
      const kyc = await ctx.db.get('SELECT * FROM kyc_records WHERE user_id = $1', [req.user.id]);
      res.json({ kyc: kyc || null });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'kyc/status' });
      res.status(500).json({ error: err.message });
    }
  });
};
