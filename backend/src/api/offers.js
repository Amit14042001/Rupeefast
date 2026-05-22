/**
 * RupeeFast — Loan Offers API Routes
 *
 * GET  /offers           — List user's pre-approved loan offers (filterable by ?status=)
 * POST /offers/accept    — Accept an offer → creates a loan, marks offer as 'converted'
 * POST /offers/reject    — Reject an offer → marks offer as 'rejected'
 *
 * All routes require auth. Offers are scoped to the authenticated user.
 */

const sentry = require('../sentry');
const audit = require('../audit');
const logger = require('../logger');

/**
 * Register loan offers routes on the given Router.
 * @param {object} router - Express Router
 * @param {object} ctx - Context { db, metrics, authMiddleware }
 */
module.exports = function (router, ctx) {
  const { metrics, authMiddleware } = ctx;

  // ── All routes require auth ──
  router.use(authMiddleware);

  /**
   * GET /offers
   * List the authenticated user's loan offers.
   * Query: ?status=pending  (optional filter by OfferStatus)
   */
  router.get('/', async (req, res) => {
    try {
      const { status } = req.query;
      let sql = 'SELECT * FROM loan_offers WHERE user_id = $1';
      const params = [req.user.id];

      if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
      }

      sql += ' ORDER BY created_at DESC';

      const offers = await ctx.db.all(sql, params);
      res.json({ offers });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'offers/list' });
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /offers/accept
   * Accept a pre-approved loan offer.
   *
   * Flow:
   *   1. Validate offer belongs to user, is 'pending', and not expired
   *   2. Create a loan with the offer terms
   *   3. Mark offer as 'converted' with reference to the new loan
   *
   * Body: { offer_id }
   */
  router.post('/accept', async (req, res) => {
    const { offer_id } = req.body;
    if (!offer_id) {
      return res.status(400).json({ error: 'offer_id is required' });
    }

    try {
      // Check for existing active loan
      const activeLoan = await ctx.db.get(
        'SELECT id FROM loans WHERE borrower_id = $1 AND status = $2',
        [req.user.id, 'active']
      );
      if (activeLoan) {
        return res.status(400).json({ error: 'You already have an active loan. Please complete it before accepting a new offer.' });
      }

      const offer = await ctx.db.get(
        'SELECT * FROM loan_offers WHERE id = $1 AND user_id = $2',
        [offer_id, req.user.id]
      );

      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }

      if (offer.status !== 'pending') {
        return res.status(400).json({
          error: `Offer is already ${offer.status} and cannot be accepted`,
          currentStatus: offer.status,
        });
      }

      if (new Date(offer.expires_at) < new Date()) {
        await ctx.db.run(
          'UPDATE loan_offers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['expired', offer_id]
        );
        return res.status(400).json({ error: 'Offer has expired' });
      }

      // Create the loan from offer terms
      const loanResult = await ctx.db.run(
        `INSERT INTO loans (borrower_id, amount, interest_rate, processing_fee, purpose, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          req.user.id,
          offer.amount,
          offer.interest_rate,
          offer.processing_fee || 0,
          `Pre-approved offer (${offer.source})`,
          'applied',
        ]
      );

      const loanId = loanResult.lastID;

      // Mark offer as converted
      await ctx.db.run(
        'UPDATE loan_offers SET status = $1, loan_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['converted', loanId, offer_id]
      );

      audit.log({
        userId: req.user.id,
        action: 'offer.accepted',
        resourceType: 'loan_offer',
        resourceId: offer_id,
        metadata: { loanId, amount: offer.amount, source: offer.source },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        role: req.user.role,
      }).catch(() => {});

      metrics.loansApplied.inc();
      logger.info({ userId: req.user.id, offerId: offer_id, loanId }, 'Loan offer accepted — loan created');

      res.status(201).json({
        success: true,
        loan_id: loanId,
        message: 'Offer accepted. Loan application created.',
      });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'offers/accept', offerId: offer_id });
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /offers/reject
   * Reject a pre-approved loan offer (permanently dismiss).
   *
   * Body: { offer_id }
   */
  router.post('/reject', async (req, res) => {
    const { offer_id } = req.body;
    if (!offer_id) {
      return res.status(400).json({ error: 'offer_id is required' });
    }

    try {
      const offer = await ctx.db.get(
        'SELECT * FROM loan_offers WHERE id = $1 AND user_id = $2',
        [offer_id, req.user.id]
      );

      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }

      if (offer.status !== 'pending') {
        return res.status(400).json({
          error: `Offer is already ${offer.status} and cannot be rejected`,
          currentStatus: offer.status,
        });
      }

      await ctx.db.run(
        'UPDATE loan_offers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['rejected', offer_id]
      );

      audit.log({
        userId: req.user.id,
        action: 'offer.rejected',
        resourceType: 'loan_offer',
        resourceId: offer_id,
        metadata: { amount: offer.amount, source: offer.source },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        role: req.user.role,
      }).catch(() => {});

      res.json({ success: true, message: 'Offer rejected' });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'offers/reject', offerId: offer_id });
      res.status(500).json({ error: err.message });
    }
  });
};
