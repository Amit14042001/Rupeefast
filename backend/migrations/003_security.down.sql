-- ============================================================================
-- Migration 003: Security infrastructure (DOWN)
-- ============================================================================
--
-- Drops all tables and indexes created in the UP migration.
-- Order matters: drop indexes first, then tables (cascading FK constraints).
-- ============================================================================

-- ── Drop indexes ──
DROP INDEX IF EXISTS idx_token_blacklist_user;
DROP INDEX IF EXISTS idx_token_blacklist_expires;
DROP INDEX IF EXISTS idx_token_blacklist_jti;
DROP INDEX IF EXISTS idx_device_fingerprints_risk;
DROP INDEX IF EXISTS idx_device_fingerprints_device;
DROP INDEX IF EXISTS idx_device_fingerprints_user;
DROP INDEX IF EXISTS idx_login_attempts_cleanup;
DROP INDEX IF EXISTS idx_login_attempts_mobile;
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_created;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user;

-- ── Drop tables (CASCADE to drop dependent FK constraints) ──
DROP TABLE IF EXISTS token_blacklist CASCADE;
DROP TABLE IF EXISTS device_fingerprints CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
