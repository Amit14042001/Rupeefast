-- ============================================================================
-- Migration 007: DOWN — Remove investor dashboard tables and views
-- ============================================================================

DROP VIEW IF EXISTS investor_portfolio_breakdown;
DROP VIEW IF EXISTS admin_investor_summary;
DROP TABLE IF EXISTS investor_activity_log;
DROP TABLE IF EXISTS fund_allocation_requests;
DROP TABLE IF EXISTS investor_portfolio_snapshots;
