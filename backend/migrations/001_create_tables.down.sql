-- ============================================================================
-- Migration 001 (DOWN): Drop all tables created in the initial schema
-- ============================================================================
--
-- Drops indexes first, then tables in reverse dependency order.
-- All operations use IF EXISTS so this is safe to run multiple times.
-- ============================================================================

-- Indexes first
DROP INDEX IF EXISTS idx_transactions_created;
DROP INDEX IF EXISTS idx_transactions_status;
DROP INDEX IF EXISTS idx_transactions_user;
DROP INDEX IF EXISTS idx_mandates_subscription;
DROP INDEX IF EXISTS idx_mandates_status;
DROP INDEX IF EXISTS idx_mandates_user;
DROP INDEX IF EXISTS idx_agent_tasks_status;
DROP INDEX IF EXISTS idx_agent_tasks_agent;
DROP INDEX IF EXISTS idx_investments_investor;
DROP INDEX IF EXISTS idx_repayments_due;
DROP INDEX IF EXISTS idx_repayments_loan;
DROP INDEX IF EXISTS idx_loans_status;
DROP INDEX IF EXISTS idx_loans_borrower;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_mobile;

-- Tables (reverse dependency order)
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS payment_mandates;
DROP TABLE IF EXISTS agent_tasks;
DROP TABLE IF EXISTS investments;
DROP TABLE IF EXISTS repayments;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS users;
