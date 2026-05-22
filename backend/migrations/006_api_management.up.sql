-- ════════════════════════════════════════════════════════════════
-- Migration 006: API Management — keys, webhooks, health checks
-- ════════════════════════════════════════════════════════════════

-- ── API Keys ───────────────────────────────────────────────────
-- Tracks third-party API keys used by the platform (Razorpay,
-- SMS gateway, WhatsApp, KYC provider, etc.) with rotation history.
CREATE TABLE IF NOT EXISTS api_keys (
    id              SERIAL PRIMARY KEY,
    service_name    TEXT NOT NULL,          -- e.g., 'razorpay', 'sms_gateway', 'whatsapp', 'kyc_provider'
    key_label       TEXT NOT NULL,          -- Human label: 'Razorpay Live', 'MSG91 Production'
    key_prefix      TEXT,                   -- First 8 chars of the key for identification
    environment     TEXT NOT NULL DEFAULT 'production'
                                CHECK (environment IN ('development', 'staging', 'production')),
    status          TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'expired', 'revoked', 'rotated')),
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    rotated_from_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at      TIMESTAMPTZ,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service_name);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_env ON api_keys(environment);

-- ── Webhook Logs ───────────────────────────────────────────────
-- Captures every incoming webhook event for monitoring & replay.
CREATE TABLE IF NOT EXISTS webhook_logs (
    id              SERIAL PRIMARY KEY,
    provider        TEXT NOT NULL,          -- 'razorpay', 'sms_dlr', 'whatsapp_dlr'
    event_type      TEXT NOT NULL,          -- 'payment.captured', 'subscription.charged', etc.
    event_id        TEXT,                   -- Provider's unique event ID for dedup
    http_method     TEXT NOT NULL DEFAULT 'POST',
    source_ip       TEXT,
    headers         JSONB,
    raw_body        TEXT,
    parsed_body     JSONB,
    status          TEXT NOT NULL DEFAULT 'received'
                                CHECK (status IN ('received', 'processed', 'failed', 'replayed', 'ignored')),
    http_status     INTEGER,                -- Response HTTP status code
    error_message   TEXT,
    processing_time_ms INTEGER,             -- How long processing took
    replayed_from   INTEGER REFERENCES webhook_logs(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- ── Service Health Checks ──────────────────────────────────────
-- Periodic health check results for each third-party integration.
CREATE TABLE IF NOT EXISTS service_health_checks (
    id              SERIAL PRIMARY KEY,
    service_name    TEXT NOT NULL,          -- 'razorpay_api', 'sms_gateway', 'whatsapp_api', 'kyc_api', 'postgres', 'redis'
    status          TEXT NOT NULL
                                CHECK (status IN ('up', 'degraded', 'down', 'unknown')),
    response_time_ms INTEGER,               -- Latency of the check
    endpoint_tested TEXT,                   -- The URL or endpoint checked
    error_message   TEXT,
    details         JSONB,                  -- Extra metadata (version, region, etc.)
    checked_by      TEXT NOT NULL DEFAULT 'system'
                                CHECK (checked_by IN ('system', 'manual')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_service ON service_health_checks(service_name);
CREATE INDEX IF NOT EXISTS idx_health_status ON service_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_created ON service_health_checks(created_at DESC);

-- ── Integration Config ─────────────────────────────────────────
-- Stores integration configuration (endpoints, feature flags, etc.)
CREATE TABLE IF NOT EXISTS integration_config (
    id              SERIAL PRIMARY KEY,
    service_name    TEXT NOT NULL UNIQUE,   -- 'razorpay', 'sms_gateway', 'whatsapp', 'kyc_provider'
    display_name    TEXT NOT NULL,
    base_url        TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    feature_flags   JSONB NOT NULL DEFAULT '{}',
    last_checked_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_enabled ON integration_config(is_enabled);
