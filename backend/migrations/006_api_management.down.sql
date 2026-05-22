-- ════════════════════════════════════════════════════════════════
-- Migration 006: Rollback API Management tables
-- ════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS integration_config;
DROP TABLE IF EXISTS service_health_checks;
DROP TABLE IF EXISTS webhook_logs;
DROP TABLE IF EXISTS api_keys;
