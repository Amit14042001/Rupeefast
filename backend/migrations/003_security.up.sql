-- ============================================================================
-- Migration 003: Security infrastructure
-- ============================================================================
--
-- Adds tables and columns for:
--   1. audit_logs — immutable log of all sensitive operations
--   2. login_attempts — tracking for brute-force protection (DB fallback)
--   3. device_fingerprints — device attestation records (Play Integrity)
-- ============================================================================

-- ── 1. AUDIT LOGS ──────────────────────────────────────────────────────────
--
-- Immutable log of all sensitive operations. Rows are never deleted or updated
-- (retention/archival handled by a separate cleanup job).
--
-- Indexed by: user_id, action, created_at (for fast compliance queries)
-- Partitioned by: created_at for time-based archiving at scale.

CREATE TABLE IF NOT EXISTS audit_logs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER,
  action        TEXT NOT NULL,        -- Dot-notation: 'auth.login', 'kyc.submit', etc.
  resource_type TEXT,                 -- 'loan', 'kyc_record', 'payment_mandate', 'user'
  resource_id   TEXT,                 -- ID of the affected resource
  metadata      JSONB,               -- Arbitrary context (sanitized request body, status codes, etc.)
  ip_address    TEXT,
  user_agent    TEXT,
  role          TEXT,                 -- User's role at time of action
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ── 2. LOGIN ATTEMPTS (DB fallback for rate limiting) ─────────────────────
--
-- Tracks login/OTP verify attempts per mobile number.
-- Used as a DB-backed fallback when Redis is unavailable.
-- Cleaned up by the same TTL logic (polling cleanup job or TTL-based partition).

CREATE TABLE IF NOT EXISTS login_attempts (
  id            SERIAL PRIMARY KEY,
  mobile        TEXT NOT NULL,
  attempt_type  TEXT NOT NULL CHECK(attempt_type IN ('otp_send', 'otp_verify', 'login')),
  success       BOOLEAN DEFAULT FALSE,
  ip_address    TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_mobile ON login_attempts(mobile, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_cleanup ON login_attempts(created_at);

-- ── 3. DEVICE FINGERPRINTS ─────────────────────────────────────────────────
--
-- Stores device attestation results from Play Integrity API.
-- Used for fraud detection and risk scoring.

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER,
  device_id         TEXT NOT NULL,
  platform          TEXT CHECK(platform IN ('android', 'ios', 'web')),
  integrity_token   TEXT,
  integrity_result  JSONB,            -- Full Play Integrity verdict
  risk_score        INTEGER DEFAULT 0,  -- 0-100, higher = riskier
  is_emulator       BOOLEAN DEFAULT FALSE,
  is_rooted         BOOLEAN DEFAULT FALSE,
  is_tampered       BOOLEAN DEFAULT FALSE,
  app_version       TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_device ON device_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_risk ON device_fingerprints(risk_score);

-- ── 4. SESSION BLACKLIST ───────────────────────────────────────────────────
--
-- Stores JWT tokens that have been revoked (logout, password change, admin force-logout).
-- Cleaned up by checking expiry.

CREATE TABLE IF NOT EXISTS token_blacklist (
  id            SERIAL PRIMARY KEY,
  jti           TEXT UNIQUE NOT NULL,       -- JWT ID (unique token identifier)
  user_id       INTEGER NOT NULL,
  expires_at    TIMESTAMP NOT NULL,         -- When the token would have expired
  revoked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason        TEXT DEFAULT 'logout',
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user ON token_blacklist(user_id);

-- ── 5. Add constraints to existing tables ─────────────────────────────────

-- Add unique constraint on user_id in kyc_records if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_records_user_id_key'
  ) THEN
    ALTER TABLE kyc_records ADD CONSTRAINT kyc_records_user_id_key UNIQUE (user_id);
  END IF;
END $$;
