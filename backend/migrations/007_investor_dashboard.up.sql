-- ============================================================================
-- Migration 007: Investor Dashboard Analytics
-- ============================================================================
--
-- Creates views and helper tables for the admin investor management dashboard.
-- Includes portfolio analytics, fund allocation tracking, and investor lifecycle.
--
-- ⚠ Idempotent — safe to run multiple times.
-- ============================================================================

-- ── 1. INVESTOR_PORTFOLIO_SNAPSHOTS ─────────────────────────────────────────
-- Tracks periodic snapshots of investor portfolio value for growth charts.
CREATE TABLE IF NOT EXISTS investor_portfolio_snapshots (
  id            SERIAL PRIMARY KEY,
  investor_id   INTEGER NOT NULL REFERENCES users(id),
  total_value   NUMERIC NOT NULL,
  total_invested NUMERIC NOT NULL,
  total_returns  NUMERIC NOT NULL,
  active_count   INTEGER DEFAULT 0,
  snapshot_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(investor_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_investor_date
  ON investor_portfolio_snapshots(investor_id, snapshot_date DESC);

-- ── 2. FUND_ALLOCATION_REQUESTS ─────────────────────────────────────────────
-- Tracks investor requests to deploy or withdraw funds from specific buckets.
CREATE TABLE IF NOT EXISTS fund_allocation_requests (
  id              SERIAL PRIMARY KEY,
  investor_id     INTEGER NOT NULL REFERENCES users(id),
  type            TEXT CHECK(type IN ('deploy', 'withdraw')) NOT NULL,
  amount          NUMERIC NOT NULL,
  risk_bucket     TEXT,
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'executed', 'cancelled')),
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TIMESTAMP,
  notes           TEXT,
  executed_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_allocation_investor
  ON fund_allocation_requests(investor_id);
CREATE INDEX IF NOT EXISTS idx_allocation_status
  ON fund_allocation_requests(status);

-- ── 3. INVESTOR_ACTIVITY_LOG ────────────────────────────────────────────────
-- Lightweight activity feed for the investor dashboard.
CREATE TABLE IF NOT EXISTS investor_activity_log (
  id            SERIAL PRIMARY KEY,
  investor_id   INTEGER NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  details       JSONB,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_investor
  ON investor_activity_log(investor_id, created_at DESC);

-- ── 4. ADMIN INVESTOR DASHBOARD VIEW ────────────────────────────────────────
-- Pre-joined view of all investors with aggregated metrics.
-- Used by the admin investor management routes.
DROP VIEW IF EXISTS admin_investor_summary;
CREATE VIEW admin_investor_summary AS
SELECT
  u.id,
  u.name,
  u.mobile,
  u.kyc_status,
  u.trust_score,
  u.created_at AS joined_at,
  COALESCE(i_data.total_invested, 0) AS total_invested,
  COALESCE(i_data.total_returns, 0) AS total_returns,
  COALESCE(i_data.active_count, 0) AS active_investments,
  COALESCE(i_data.investment_count, 0) AS total_investments,
  CASE
    WHEN COALESCE(i_data.total_invested, 0) > 0
    THEN ROUND((COALESCE(i_data.total_returns, 0) * 100.0 / COALESCE(i_data.total_invested, 0))::numeric, 1)
    ELSE 0
  END AS roi_pct,
  COALESCE(
    (SELECT COUNT(*) FROM fund_allocation_requests far
      WHERE far.investor_id = u.id AND far.status = 'pending'),
    0
  ) AS pending_requests,
  -- Last activity timestamp from any investor-related table
  GREATEST(
    COALESCE(u.created_at, '1970-01-01'::timestamp),
    COALESCE((SELECT MAX(created_at) FROM investments WHERE investor_id = u.id), '1970-01-01'::timestamp),
    COALESCE((SELECT MAX(created_at) FROM investor_activity_log WHERE investor_id = u.id), '1970-01-01'::timestamp),
    COALESCE((SELECT MAX(created_at) FROM transactions WHERE user_id = u.id AND type = 'investment'), '1970-01-01'::timestamp)
  ) AS last_active_at
FROM users u
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE i.status = 'active') AS active_count,
    COUNT(*) AS investment_count,
    COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'active'), 0) AS total_invested,
    COALESCE(SUM(i.returns) FILTER (WHERE i.status = 'active'), 0) AS total_returns
  FROM investments i
  WHERE i.investor_id = u.id
) i_data ON TRUE
WHERE u.role = 'investor'
ORDER BY COALESCE(i_data.total_invested, 0) DESC;

-- ── 5. INVESTOR_PORTFOLIO_BREAKDOWN VIEW ───────────────────────────────────
-- Per-investor breakdown of investments by risk bucket.
DROP VIEW IF EXISTS investor_portfolio_breakdown;
CREATE VIEW investor_portfolio_breakdown AS
SELECT
  i.investor_id,
  i.risk_bucket,
  COUNT(*) AS investment_count,
  SUM(i.amount) AS total_amount,
  SUM(i.returns) AS total_returns,
  CASE
    WHEN SUM(i.amount) > 0
    THEN ROUND((SUM(i.returns) * 100.0 / SUM(i.amount))::numeric, 1)
    ELSE 0
  END AS bucket_roi
FROM investments i
WHERE i.status = 'active'
GROUP BY i.investor_id, i.risk_bucket
ORDER BY i.investor_id, total_amount DESC;
