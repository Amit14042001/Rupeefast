-- ============================================================================
-- Migration 004: DOWN — Rollback Notification Broadcasting System
-- ============================================================================

DROP INDEX IF EXISTS idx_notif_broadcasts_template;
DROP INDEX IF EXISTS idx_notif_broadcasts_created;
DROP INDEX IF EXISTS idx_notif_broadcasts_status;

DROP TABLE IF EXISTS notification_broadcasts;

DROP INDEX IF EXISTS idx_notif_templates_active;
DROP INDEX IF EXISTS idx_notif_templates_channel;

DROP TABLE IF EXISTS notification_templates;

-- ============================================================================
-- End of migration 004 (DOWN)
-- ============================================================================
