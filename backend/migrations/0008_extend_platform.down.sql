-- ============================================================================
-- Migration 008: Extend platform (DOWN)
-- ============================================================================
--
-- Reverses all changes from UP migration:
--   1. Drops new tables: loan_offers, collection_logs, fraud_events
--   2. Removes columns added to: users, loans, repayments, payment_mandates,
--      transactions, audit_logs
--
-- Order matters: drop FK-dependent tables first, then remove columns.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DROP NEW TABLES (with CASCADE to drop dependent FK constraints)
-- ════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_loan_offers_user;
DROP INDEX IF EXISTS idx_loan_offers_status;
DROP INDEX IF EXISTS idx_loan_offers_expires;
DROP INDEX IF EXISTS idx_loan_offers_source;
DROP TABLE IF EXISTS loan_offers CASCADE;

DROP INDEX IF EXISTS idx_collection_logs_loan;
DROP INDEX IF EXISTS idx_collection_logs_agent;
DROP INDEX IF EXISTS idx_collection_logs_status;
DROP INDEX IF EXISTS idx_collection_logs_created;
DROP INDEX IF EXISTS idx_collection_logs_promise;
DROP TABLE IF EXISTS collection_logs CASCADE;

DROP INDEX IF EXISTS idx_fraud_events_user;
DROP INDEX IF EXISTS idx_fraud_events_type;
DROP INDEX IF EXISTS idx_fraud_events_severity;
DROP INDEX IF EXISTS idx_fraud_events_status;
DROP INDEX IF EXISTS idx_fraud_events_created;
DROP INDEX IF EXISTS idx_fraud_events_open;
DROP TABLE IF EXISTS fraud_events CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. KYC RECORDS — drop indexes added by 008 (table not dropped — may pre-exist)
-- ════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_kyc_records_status;
DROP INDEX IF EXISTS idx_kyc_records_verified;

-- Note: kyc_records table is NOT dropped here because it may have existed
-- before migration 008 was applied (it was created outside the migration system).
-- Dropping it would be destructive. The new columns added by 008 follow the
-- safe DO $$ pattern with IF NOT EXISTS guards, so no column removal is needed.

-- ════════════════════════════════════════════════════════════════════════════
-- 3. AUDIT LOGS — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_audit_logs_request;
DROP INDEX IF EXISTS idx_audit_logs_entity;

ALTER TABLE audit_logs DROP COLUMN IF EXISTS request_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS entity_type;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS changes;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. USERS — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_active;
DROP INDEX IF EXISTS idx_users_fraud;

ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS device_id;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_active;
ALTER TABLE users DROP COLUMN IF EXISTS fraud_flag;
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. LOANS — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE loans DROP COLUMN IF EXISTS interest_rate;
ALTER TABLE loans DROP COLUMN IF EXISTS processing_fee;
ALTER TABLE loans DROP COLUMN IF EXISTS approved_by;
ALTER TABLE loans DROP COLUMN IF EXISTS approved_at;
ALTER TABLE loans DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE loans DROP COLUMN IF EXISTS loan_officer_notes;
ALTER TABLE loans DROP COLUMN IF EXISTS updated_at;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. REPAYMENTS — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE repayments DROP COLUMN IF EXISTS collected_by;
ALTER TABLE repayments DROP COLUMN IF EXISTS collection_method_details;
ALTER TABLE repayments DROP COLUMN IF EXISTS transaction_id;
ALTER TABLE repayments DROP COLUMN IF EXISTS notes;
ALTER TABLE repayments DROP COLUMN IF EXISTS updated_at;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PAYMENT MANDATES — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_mandates DROP COLUMN IF EXISTS mandate_type_details;
ALTER TABLE payment_mandates DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE payment_mandates DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE payment_mandates DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE payment_mandates DROP COLUMN IF EXISTS updated_at;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. TRANSACTIONS — remove added columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE transactions DROP COLUMN IF EXISTS gateway_response;
ALTER TABLE transactions DROP COLUMN IF EXISTS fee;
ALTER TABLE transactions DROP COLUMN IF EXISTS net_amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS description;
ALTER TABLE transactions DROP COLUMN IF EXISTS updated_at;

-- ════════════════════════════════════════════════════════════════════════════
-- End of migration 008 (DOWN)
-- ════════════════════════════════════════════════════════════════════════════
