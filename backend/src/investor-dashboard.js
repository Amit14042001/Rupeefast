/**
 * RupeeFast — Admin Investor Dashboard Service
 *
 * Provides analytics, portfolio tracking, fund allocation management,
 * and lifecycle tools for the admin investor management screens.
 */

const logger = require('./logger');

// ══════════════════════════════════════════════════
// PORTFOLIO ANALYTICS
// ══════════════════════════════════════════════════

/**
 * Get aggregated portfolio metrics across all investors.
 * @returns {Promise<object>} { totalInvestors, activeInvestors, totalInvested, totalReturns, avgRoi, ... }
 */
async function getPortfolioSummary(db) {
  const summary = await db.get(`
    SELECT
      COUNT(*)::int AS total_investors,
      COUNT(*) FILTER (WHERE total_invested > 0)::int AS active_investors,
      COALESCE(SUM(total_invested), 0)::numeric AS total_invested,
      COALESCE(SUM(total_returns), 0)::numeric AS total_returns,
      CASE
        WHEN COALESCE(SUM(total_invested), 0) > 0
        THEN ROUND((COALESCE(SUM(total_returns), 0) * 100.0 / NULLIF(SUM(total_invested), 0))::numeric, 1)
        ELSE 0
      END AS avg_roi,
      COALESCE(SUM(pending_requests), 0)::int AS pending_requests
    FROM admin_investor_summary
  `);

  return summary;
}

/**
 * Get all investors with portfolio data from the admin view.
 * @param {object} filters - { search, kycStatus, sortBy, limit, offset }
 * @returns {Promise<object>} { investors, total }
 */
async function getInvestors(db, filters = {}) {
  const { search, kycStatus, sortBy, limit, offset } = filters;

  let whereClause = '';
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR mobile ILIKE $${params.length})`);
  }
  if (kycStatus) {
    params.push(kycStatus);
    conditions.push(`kyc_status = $${params.length}`);
  }

  if (conditions.length > 0) {
    whereClause = ' WHERE ' + conditions.join(' AND ');
  }

  // Validate sort by
  const allowedSorts = ['total_invested', 'roi_pct', 'joined_at', 'last_active_at', 'name'];
  const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'total_invested';
  const orderDir = sortColumn === 'joined_at' || sortColumn === 'last_active_at' ? 'DESC' : 'DESC';

  const countResult = await db.get(`SELECT COUNT(*)::int AS total FROM admin_investor_summary${whereClause}`, params);
  const investors = await db.all(
    `SELECT * FROM admin_investor_summary${whereClause} ORDER BY ${sortColumn} ${orderDir} NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit || 50, offset || 0]
  );

  return { investors, total: countResult.total };
}

/**
 * Get detailed portfolio breakdown for a single investor.
 * @param {number} investorId
 * @returns {Promise<object>} Portfolio detail with breakdown by bucket
 */
async function getInvestorDetail(db, investorId) {
  const investor = await db.get('SELECT * FROM admin_investor_summary WHERE id = $1', [investorId]);
  if (!investor) return null;

  // Portfolio breakdown by risk bucket
  const breakdown = await db.all(
    `SELECT * FROM investor_portfolio_breakdown WHERE investor_id = $1`,
    [investorId]
  );

  // Individual investments
  const investments = await db.all(
    `SELECT i.*, l.amount AS loan_amount, l.status AS loan_status, l.purpose
     FROM investments i
     LEFT JOIN loans l ON i.loan_id = l.id
     WHERE i.investor_id = $1
     ORDER BY i.created_at DESC`,
    [investorId]
  );

  // Recent activity
  const activity = await db.all(
    `SELECT * FROM investor_activity_log WHERE investor_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [investorId]
  );

  // Fund allocation requests
  const allocationRequests = await db.all(
    `SELECT far.*, u.name AS reviewer_name
     FROM fund_allocation_requests far
     LEFT JOIN users u ON far.reviewed_by = u.id
     WHERE far.investor_id = $1
     ORDER BY far.created_at DESC`,
    [investorId]
  );

  // Portfolio value history (last 30 days)
  const snapshots = await db.all(
    `SELECT * FROM investor_portfolio_snapshots
     WHERE investor_id = $1 AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY snapshot_date ASC`,
    [investorId]
  );

  return {
    ...investor,
    breakdown,
    investments,
    activity,
    allocationRequests,
    snapshots,
  };
}

// ══════════════════════════════════════════════════
// FUND ALLOCATION MANAGEMENT
// ══════════════════════════════════════════════════

/**
 * List fund allocation requests with filtering.
 * @param {object} filters - { status, investorId, type }
 * @returns {Promise<object>} { requests }
 */
async function getAllocationRequests(db, filters = {}) {
  const { status, investorId, type } = filters;
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`far.status = $${params.length}`);
  }
  if (investorId) {
    params.push(investorId);
    conditions.push(`far.investor_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`far.type = $${params.length}`);
  }

  let whereClause = '';
  if (conditions.length > 0) {
    whereClause = ' WHERE ' + conditions.join(' AND ');
  }

  const requests = await db.all(
    `SELECT far.*, u.name AS investor_name, u.mobile AS investor_mobile,
            r.name AS reviewer_name
     FROM fund_allocation_requests far
     JOIN users u ON far.investor_id = u.id
     LEFT JOIN users r ON far.reviewed_by = r.id
     ${whereClause}
     ORDER BY far.created_at DESC`,
    params
  );

  return { requests };
}

/**
 * Approve a fund allocation request.
 * @param {number} requestId
 * @param {number} adminId
 * @returns {Promise<object>} Updated request
 */
async function approveAllocationRequest(db, requestId, adminId) {
  const request = await db.get(
    'SELECT * FROM fund_allocation_requests WHERE id = $1',
    [requestId]
  );
  if (!request) throw new Error('Allocation request not found');
  if (request.status !== 'pending') throw new Error(`Cannot approve request with status "${request.status}"`);

  await db.run(
    `UPDATE fund_allocation_requests
     SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    ['approved', adminId, requestId]
  );

  // Log activity
  await logInvestorActivity(db, request.investor_id, 'allocation.approved', {
    requestId,
    type: request.type,
    amount: request.amount,
    adminId,
  });

  return { ...request, status: 'approved', reviewed_by: adminId };
}

/**
 * Reject a fund allocation request.
 * @param {number} requestId
 * @param {number} adminId
 * @param {string} reason
 * @returns {Promise<object>} Updated request
 */
async function rejectAllocationRequest(db, requestId, adminId, reason) {
  const request = await db.get(
    'SELECT * FROM fund_allocation_requests WHERE id = $1',
    [requestId]
  );
  if (!request) throw new Error('Allocation request not found');
  if (request.status !== 'pending') throw new Error(`Cannot reject request with status "${request.status}"`);

  await db.run(
    `UPDATE fund_allocation_requests
     SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, notes = $3
     WHERE id = $4`,
    ['rejected', adminId, reason || null, requestId]
  );

  // Log activity
  await logInvestorActivity(db, request.investor_id, 'allocation.rejected', {
    requestId,
    type: request.type,
    amount: request.amount,
    reason,
    adminId,
  });

  return { ...request, status: 'rejected', reviewed_by: adminId, notes: reason };
}

/**
 * Execute an approved allocation request — fulfilment.
 * @param {number} requestId
 * @param {number} adminId
 * @returns {Promise<object>} Updated request
 */
async function executeAllocationRequest(db, requestId, adminId) {
  const request = await db.get(
    'SELECT * FROM fund_allocation_requests WHERE id = $1',
    [requestId]
  );
  if (!request) throw new Error('Allocation request not found');
  if (request.status !== 'approved') throw new Error('Only approved requests can be executed');

  await db.run(
    `UPDATE fund_allocation_requests
     SET status = $1, executed_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    ['executed', requestId]
  );

  // Log activity
  await logInvestorActivity(db, request.investor_id, 'allocation.executed', {
    requestId,
    type: request.type,
    amount: request.amount,
    adminId,
  });

  return { ...request, status: 'executed' };
}

// ══════════════════════════════════════════════════
// INVESTOR LIFECYCLE
// ══════════════════════════════════════════════════

/**
 * Log an activity entry for an investor.
 */
async function logInvestorActivity(db, investorId, action, details = {}) {
  try {
    await db.run(
      `INSERT INTO investor_activity_log (investor_id, action, details)
       VALUES ($1, $2, $3)`,
      [investorId, action, JSON.stringify(details)]
    );
  } catch (err) {
    logger.warn({ err: err.message, investorId, action }, 'Failed to log investor activity');
  }
}

/**
 * Add an internal note/comment to an investor's profile.
 * @param {number} investorId
 * @param {string} note
 * @param {number} adminId
 */
async function addInvestorNote(db, investorId, note, adminId) {
  await logInvestorActivity(db, investorId, 'admin.note', {
    note,
    adminId,
  });
}

/**
 * Get aggregate investor metrics for the dashboard header.
 * @returns {Promise<object>}
 */
async function getInvestorMetrics(db) {
  const metrics = await db.get(`
    SELECT
      COUNT(*)::int AS total_investors,
      COUNT(*) FILTER (WHERE kyc_status = 'verified')::int AS kyc_verified,
      COUNT(*) FILTER (WHERE total_invested > 0)::int AS funded_investors,
      COUNT(*) FILTER (WHERE total_invested = 0)::int AS unfunded_investors,
      COUNT(*) FILTER (WHERE pending_requests > 0)::int AS investors_with_requests,
      ROUND(AVG(total_invested) FILTER (WHERE total_invested > 0))::numeric AS avg_investment,
      COALESCE(SUM(total_invested), 0)::numeric AS total_aum,
      COALESCE(SUM(pending_requests), 0)::int AS total_pending_requests
    FROM admin_investor_summary
  `);

  // Growth trend — new investors per month (last 6)
  const growth = await db.all(`
    SELECT
      TO_CHAR(joined_at, 'YYYY-MM') AS month,
      COUNT(*)::int AS new_investors
    FROM users
    WHERE role = 'investor' AND joined_at >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month ASC
  `);

  // Top investors by AUM
  const topInvestors = await db.all(`
    SELECT id, name, mobile, total_invested, roi_pct, last_active_at
    FROM admin_investor_summary
    WHERE total_invested > 0
    ORDER BY total_invested DESC
    LIMIT 10
  `);

  return { ...metrics, growth, topInvestors };
}

/**
 * Get AUM trend over time (from portfolio snapshots across all investors).
 * @param {number} days - Lookback period
 * @returns {Promise<array>}
 */
async function getAumTrend(db, days = 30) {
  const trend = await db.all(`
    SELECT
      snapshot_date,
      SUM(total_value)::numeric AS aum,
      SUM(total_invested)::numeric AS total_invested,
      SUM(total_returns)::numeric AS total_returns
    FROM investor_portfolio_snapshots
    WHERE snapshot_date >= CURRENT_DATE - $1::interval
    GROUP BY snapshot_date
    ORDER BY snapshot_date ASC
  `, [`${days} days`]);

  return trend;
}

/**
 * Record a daily portfolio snapshot for all active investors.
 * Called by a cron job (e.g., via PM2 cron or a scheduler).
 */
async function recordDailySnapshots(db) {
  const investors = await db.all(`
    SELECT id FROM users WHERE role = 'investor' AND id IN (
      SELECT DISTINCT investor_id FROM investments WHERE status = 'active'
    )
  `);

  const today = new Date().toISOString().slice(0, 10);

  for (const inv of investors) {
    const portfolio = await db.get(`
      SELECT
        COALESCE(SUM(amount), 0) AS total_invested,
        COALESCE(SUM(returns), 0) AS total_returns,
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COALESCE(SUM(amount) + SUM(returns), 0) AS total_value
      FROM investments WHERE investor_id = $1
    `, [inv.id]);

    await db.run(
      `INSERT INTO investor_portfolio_snapshots (investor_id, total_value, total_invested, total_returns, active_count, snapshot_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (investor_id, snapshot_date)
       DO UPDATE SET total_value = EXCLUDED.total_value,
                     total_invested = EXCLUDED.total_invested,
                     total_returns = EXCLUDED.total_returns,
                     active_count = EXCLUDED.active_count`,
      [inv.id, portfolio.total_value, portfolio.total_invested, portfolio.total_returns, portfolio.active_count, today]
    );
  }

  logger.info({ count: investors.length }, 'Daily investor portfolio snapshots recorded');
  return { recorded: investors.length };
}

module.exports = {
  getPortfolioSummary,
  getInvestors,
  getInvestorDetail,
  getAllocationRequests,
  approveAllocationRequest,
  rejectAllocationRequest,
  executeAllocationRequest,
  getInvestorMetrics,
  getAumTrend,
  recordDailySnapshots,
  logInvestorActivity,
  addInvestorNote,
};
