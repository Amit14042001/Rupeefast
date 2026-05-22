/**
 * RupeeFast — Admin Investor Dashboard API Routes
 *
 * Portfolio analytics, fund allocation management, investor lifecycle.
 * All routes require admin role.
 */

const sentry = require('../../sentry');
const audit = require('../../audit');
const investorDashboard = require('../../investor-dashboard');

/**
 * Register admin investor routes on the given Router.
 */
module.exports = function (router, ctx) {
  const { authMiddleware } = ctx;

  // ── Enforce admin role ──
  router.use(authMiddleware, (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });

  // ── Portfolio summary ──
  router.get('/summary', async (req, res) => {
    try {
      const summary = await investorDashboard.getPortfolioSummary(ctx.db);
      const metrics = await investorDashboard.getInvestorMetrics(ctx.db);
      res.json({ summary, metrics });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors/summary' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── List investors ──
  router.get('/', async (req, res) => {
    try {
      const { search, kyc_status, sort_by, limit, offset } = req.query;
      const result = await investorDashboard.getInvestors(ctx.db, {
        search, kycStatus: kyc_status, sortBy: sort_by,
        limit: parseInt(limit, 10) || 50, offset: parseInt(offset, 10) || 0,
      });
      res.json(result);
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Investor detail ──
  router.get('/detail/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid investor ID' });
      const detail = await investorDashboard.getInvestorDetail(ctx.db, id);
      if (!detail) return res.status(404).json({ error: 'Investor not found' });
      res.json({ investor: detail });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors/detail' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── List allocation requests ──
  router.get('/allocation-requests', async (req, res) => {
    try {
      const { status, investor_id, type } = req.query;
      const result = await investorDashboard.getAllocationRequests(ctx.db, {
        status, investorId: investor_id ? parseInt(investor_id, 10) : undefined, type,
      });
      res.json(result);
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors/allocation-requests' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Approve allocation ──
  router.post('/allocation-requests/:id/approve', async (req, res) => {
    try {
      const result = await investorDashboard.approveAllocationRequest(ctx.db, parseInt(req.params.id), req.user.id);
      audit.log({
        userId: req.user.id, action: 'admin.investor.allocation.approve', resourceType: 'fund_allocation_request',
        resourceId: parseInt(req.params.id), metadata: { type: result.type, amount: result.amount, investorId: result.investor_id },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, request: result });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/investors/allocation-requests/approve' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Reject allocation ──
  router.post('/allocation-requests/:id/reject', async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await investorDashboard.rejectAllocationRequest(ctx.db, parseInt(req.params.id), req.user.id, reason || 'Rejected by admin');
      audit.log({
        userId: req.user.id, action: 'admin.investor.allocation.reject', resourceType: 'fund_allocation_request',
        resourceId: parseInt(req.params.id), metadata: { type: result.type, amount: result.amount, reason },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, request: result });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/investors/allocation-requests/reject' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Execute allocation ──
  router.post('/allocation-requests/:id/execute', async (req, res) => {
    try {
      const result = await investorDashboard.executeAllocationRequest(ctx.db, parseInt(req.params.id), req.user.id);
      audit.log({
        userId: req.user.id, action: 'admin.investor.allocation.execute', resourceType: 'fund_allocation_request',
        resourceId: parseInt(req.params.id), metadata: { type: result.type, amount: result.amount },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, request: result });
    } catch (err) {
      if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
      sentry.captureError(err, { route: 'admin/investors/allocation-requests/execute' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── Add note ──
  router.post('/:id/notes', async (req, res) => {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'Note text is required' });
    try {
      await investorDashboard.addInvestorNote(ctx.db, parseInt(req.params.id), note, req.user.id);
      audit.log({
        userId: req.user.id, action: 'admin.investor.note', resourceType: 'investor',
        resourceId: parseInt(req.params.id), metadata: { noteSnippet: note.slice(0, 100) },
        ipAddress: req.ip, userAgent: req.headers['user-agent'], role: req.user.role,
      }).catch(() => {});
      res.json({ success: true, message: 'Note added' });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors/notes' });
      res.status(500).json({ error: err.message });
    }
  });

  // ── AUM trend ──
  router.get('/aum-trend', async (req, res) => {
    try {
      const { days } = req.query;
      const trend = await investorDashboard.getAumTrend(ctx.db, parseInt(days, 10) || 30);
      res.json({ trend });
    } catch (err) {
      sentry.captureError(err, { route: 'admin/investors/aum-trend' });
      res.status(500).json({ error: err.message });
    }
  });
};
