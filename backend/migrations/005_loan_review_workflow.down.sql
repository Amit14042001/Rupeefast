-- ============================================================================
-- Migration 005: DOWN — Rollback loan review workflow
-- ============================================================================

DROP TABLE IF EXISTS loan_reviewers;
DROP TABLE IF EXISTS loan_documents;
DROP TABLE IF EXISTS loan_reviews;
DROP TABLE IF EXISTS admin_roles;

-- Restore original loan status constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check;
-- Don't re-add the old one since it may differ per deployment
