/**
 * RupeeFast — Credit API Routes
 *
 * GET /score         — Get credit score (auto-generates mock for new users)
 * GET /bureau-report — CIBIL/NPCL credit bureau stub
 */

const sentry = require('../sentry');

/**
 * Register credit routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { authMiddleware } = ctx;

  // 15. Get credit score
  router.get('/score', authMiddleware, async (req, res) => {
    try {
      let score = await ctx.db.get('SELECT * FROM credit_scores WHERE user_id = $1', [req.user.id]);
      if (!score) {
        const baseScore = 600 + Math.floor(Math.random() * 200);
        await ctx.db.run('INSERT INTO credit_scores (user_id, score, source) VALUES ($1, $2, $3)', [req.user.id, baseScore, 'internal_mock']);
        score = { user_id: req.user.id, score: baseScore };
      }
      res.json({ score });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'credit/score' });
      res.status(500).json({ error: err.message });
    }
  });

  // 16. CIBIL / NPCL credit bureau integration stub
  router.get('/bureau-report', authMiddleware, async (req, res) => {
    try {
      const user = await ctx.db.get('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const bureauReport = {
        source: process.env.CIBIL_API_ENABLED === 'true' ? 'cibil' : 'stub',
        report_date: new Date().toISOString(),
        credit_score: 650 + Math.floor(Math.random() * 150),
        total_accounts: 3,
        active_accounts: 1,
        delinquent_accounts: 0,
        inquiries_last_6_months: 2,
        credit_utilization_pct: 35,
        remarks: 'Stub response — integrate with CIBIL/NPCL API for production data',
      };
      res.json({ bureau_report: bureauReport });
    } catch (err) {
      sentry.captureError(err, { userId: req.user?.id, route: 'credit/bureau-report' });
      res.status(500).json({ error: err.message });
    }
  });
};
