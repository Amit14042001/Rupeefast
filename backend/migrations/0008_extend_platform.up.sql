-- ============================================================================
-- Migration 008: Extend platform — new tables + column additions
-- ============================================================================
--
-- Creates 3 new tables (others use IF NOT EXISTS for idempotency):
--   1. loan_offers     — Pre-approved loan offers for borrowers
--   2. collection_logs — Field agent collection attempt tracking
--   3. fraud_events    — Fraud detection event ledger
--
-- Adds columns to existing tables:
--   users, loans, repayments, payment_mandates, transactions, audit_logs
--
-- All DDL uses IF NOT EXISTS / IF EXISTS for safe re-execution.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. KYC RECORDS (idempotent — safe if table already exists)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Enhanced KYC records table with face verification, document metadata,
-- and multi-step verification tracking. Supersedes the existing kyc_records
-- schema that was created outside migrations.
--
-- NOTE: Uses IF NOT EXISTS so this is a no-op if the table already exists.

CREATE TABLE IF NOT EXISTS kyc_records (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  aadhaar_number      TEXT,
  pan_number          TEXT,
  aadhaar_verified    BOOLEAN DEFAULT FALSE,
  pan_verified        BOOLEAN DEFAULT FALSE,
  face_verified       BOOLEAN DEFAULT FALSE,
  face_match_score    INTEGER,               -- 0-100, how well the selfie matches Aadhaar photo
  status              TEXT DEFAULT 'pending'
                      CHECK(status IN ('not_started', 'pending', 'under_review', 'verified', 'rejected', 'expired')),
  rejection_reason    TEXT,
  document_urls       JSONB DEFAULT '[]'::jsonb,   -- Array of S3/cloud URLs for uploaded docs
  submitted_at        TIMESTAMP,
  verified_at         TIMESTAMP,
  verified_by         INTEGER REFERENCES users(id),
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure unique constraint on user_id (matches what migration 003 adds)
-- Using DO block to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_records_user_id_key'
  ) THEN
    ALTER TABLE kyc_records ADD CONSTRAINT kyc_records_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Add new columns if they don't already exist (safe for existing databases
-- where the table was created outside migrations with fewer columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'aadhaar_verified') THEN
    ALTER TABLE kyc_records ADD COLUMN aadhaar_verified BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'pan_verified') THEN
    ALTER TABLE kyc_records ADD COLUMN pan_verified BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'face_verified') THEN
    ALTER TABLE kyc_records ADD COLUMN face_verified BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'face_match_score') THEN
    ALTER TABLE kyc_records ADD COLUMN face_match_score INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'document_urls') THEN
    ALTER TABLE kyc_records ADD COLUMN document_urls JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'submitted_at') THEN
    ALTER TABLE kyc_records ADD COLUMN submitted_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'verified_at') THEN
    ALTER TABLE kyc_records ADD COLUMN verified_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'verified_by') THEN
    ALTER TABLE kyc_records ADD COLUMN verified_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'notes') THEN
    ALTER TABLE kyc_records ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kyc_records' AND column_name = 'updated_at') THEN
    ALTER TABLE kyc_records ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(status);
CREATE INDEX IF NOT EXISTS idx_kyc_records_verified ON kyc_records(verified_by);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LOAN OFFERS (new table)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Pre-approved loan offers generated by the credit engine or manually by admins.
-- Borrowers can accept, reject, or ignore offers within the expiry window.

CREATE TABLE IF NOT EXISTS loan_offers (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  loan_id             INTEGER REFERENCES loans(id),   -- Set when offer is accepted & loan created
  amount              NUMERIC NOT NULL,
  interest_rate       NUMERIC NOT NULL DEFAULT 18.0,   -- Annual interest rate in %
  tenure_days         INTEGER NOT NULL DEFAULT 365,
  processing_fee      NUMERIC DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending', 'accepted', 'rejected', 'expired', 'converted')),
  expires_at          TIMESTAMP NOT NULL,              -- Offer expiry date
  source              TEXT DEFAULT 'credit_engine'     -- 'credit_engine', 'admin', 'campaign', 'referral'
                      CHECK(source IN ('credit_engine', 'admin', 'campaign', 'referral')),
  metadata            JSONB DEFAULT '{}'::jsonb,       -- Campaign/segment data, targeting rules
  created_by          INTEGER REFERENCES users(id),    -- Admin ID if manually created
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_offers_user ON loan_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_offers_status ON loan_offers(status);
CREATE INDEX IF NOT EXISTS idx_loan_offers_expires ON loan_offers(expires_at);
CREATE INDEX IF NOT EXISTS idx_loan_offers_source ON loan_offers(source);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. COLLECTION LOGS (new table)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Tracks each field collection attempt by agents: visits, calls, legal notices.
-- Used for recovery performance tracking, agent scorecards, and audit trail.

CREATE TABLE IF NOT EXISTS collection_logs (
  id                  SERIAL PRIMARY KEY,
  loan_id             INTEGER NOT NULL REFERENCES loans(id),
  agent_id            INTEGER NOT NULL REFERENCES users(id),
  collection_type     TEXT NOT NULL
                      CHECK(collection_type IN ('field_visit', 'phone_call', 'legal_notice', 'sms_reminder', 'email_reminder', 'home_visit', 'workplace_visit')),
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK(status IN ('scheduled', 'in_progress', 'completed', 'skipped', 'cancelled')),
  contacted_person    TEXT,                            -- Name of person contacted
  relationship        TEXT,                            -- 'self', 'spouse', 'parent', 'neighbor', 'employer', 'guarantor', 'other'
  contact_method      TEXT,                            -- 'in_person', 'phone', 'sms', 'email', 'third_party'
  amount_promised     NUMERIC,                         -- Amount borrower promised to pay
  promise_date        DATE,                            -- Date borrower promised to pay
  amount_collected    NUMERIC,                         -- Amount actually collected during this visit
  payment_id          INTEGER REFERENCES transactions(id),
  notes               TEXT,
  outcome             TEXT
                      CHECK(outcome IN ('no_response', 'promise_to_pay', 'partial_payment', 'full_payment', 'dispute', 'refused', 'not_home', 'wrong_address', 'deceased', 'legal_referral')),
  location_lat        NUMERIC,
  location_lng        NUMERIC,
  duration_minutes    INTEGER,                         -- How long the visit/contact lasted
  attachments         JSONB DEFAULT '[]'::jsonb,        -- Photo URLs, audio recordings, signed documents
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collection_logs_loan ON collection_logs(loan_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_agent ON collection_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_collection_logs_status ON collection_logs(status);
CREATE INDEX IF NOT EXISTS idx_collection_logs_created ON collection_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_collection_logs_promise ON collection_logs(promise_date)
  WHERE promise_date IS NOT NULL AND amount_promised IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. FRAUD EVENTS (new table)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Immutable ledger of all fraud detection events. Written by the fraud engine,
-- admin actions, or automated rules. Enables real-time risk scoring and
-- post-hoc investigation.

CREATE TABLE IF NOT EXISTS fraud_events (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id),
  loan_id             INTEGER REFERENCES loans(id),
  event_type          TEXT NOT NULL
                      CHECK(event_type IN (
                        'multiple_login', 'suspicious_device', 'kyc_tampering',
                        'payment_anomaly', 'identity_theft', 'account_takeover',
                        'synthetic_identity', 'document_forgery', 'circle_fraud',
                        'application_abuse', 'collusion', 'chargeback',
                        'unusual_location', 'velocity_breach', 'manual_review'
                      )),
  severity            TEXT NOT NULL DEFAULT 'medium'
                      CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK(status IN ('open', 'investigating', 'confirmed', 'dismissed', 'resolved')),
  title               TEXT NOT NULL,                   -- Human-readable summary
  description         TEXT,                             -- Detailed explanation
  metadata            JSONB DEFAULT '{}'::jsonb,        -- Device info, IPs, transaction IDs, screenshots
  risk_score_delta    INTEGER DEFAULT 0,               -- Impact on user's trust_score (-100 to 0)
  detected_by         TEXT NOT NULL DEFAULT 'system'
                      CHECK(detected_by IN ('system', 'admin_rule', 'manual', 'agent_report', 'external_api')),
  ip_address          TEXT,
  device_id           TEXT,
  action_taken        TEXT,                             -- 'user_blocked', 'loan_frozen', 'alerted', 'escalated'
  resolved_at         TIMESTAMP,
  resolved_by         INTEGER REFERENCES users(id),
  resolution          TEXT,                             -- Notes on how it was resolved
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_user ON fraud_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_events_type ON fraud_events(event_type);
CREATE INDEX IF NOT EXISTS idx_fraud_events_severity ON fraud_events(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_events_status ON fraud_events(status);
CREATE INDEX IF NOT EXISTS idx_fraud_events_created ON fraud_events(created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_events_open ON fraud_events(user_id, status)
  WHERE status IN ('open', 'investigating');

-- ════════════════════════════════════════════════════════════════════════════
-- 5. AUDIT LOGS — add entity_id and request_id columns (enhancement)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds correlation ID (for tracing requests across services) and entity_id
-- (for polymorphic resource references without relying on resource_type text).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'request_id') THEN
    ALTER TABLE audit_logs ADD COLUMN request_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_type') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_type TEXT;
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'changes') THEN
    ALTER TABLE audit_logs ADD COLUMN changes JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. USERS — add columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
    ALTER TABLE users ADD COLUMN email TEXT;
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'device_id') THEN
    ALTER TABLE users ADD COLUMN device_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_login_at') THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'fraud_flag') THEN
    ALTER TABLE users ADD COLUMN fraud_flag BOOLEAN DEFAULT FALSE;
    CREATE INDEX IF NOT EXISTS idx_users_fraud ON users(fraud_flag) WHERE fraud_flag = TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LOANS — add columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'interest_rate') THEN
    ALTER TABLE loans ADD COLUMN interest_rate NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'processing_fee') THEN
    ALTER TABLE loans ADD COLUMN processing_fee NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'approved_by') THEN
    ALTER TABLE loans ADD COLUMN approved_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'approved_at') THEN
    ALTER TABLE loans ADD COLUMN approved_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'rejection_reason') THEN
    ALTER TABLE loans ADD COLUMN rejection_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'loan_officer_notes') THEN
    ALTER TABLE loans ADD COLUMN loan_officer_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'updated_at') THEN
    ALTER TABLE loans ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. REPAYMENTS — add columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'collected_by') THEN
    ALTER TABLE repayments ADD COLUMN collected_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'collection_method_details') THEN
    ALTER TABLE repayments ADD COLUMN collection_method_details TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'transaction_id') THEN
    ALTER TABLE repayments ADD COLUMN transaction_id INTEGER REFERENCES transactions(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'notes') THEN
    ALTER TABLE repayments ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'repayments' AND column_name = 'updated_at') THEN
    ALTER TABLE repayments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. PAYMENT MANDATES — add columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_mandates' AND column_name = 'mandate_type_details') THEN
    ALTER TABLE payment_mandates ADD COLUMN mandate_type_details TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_mandates' AND column_name = 'cancelled_at') THEN
    ALTER TABLE payment_mandates ADD COLUMN cancelled_at TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_mandates' AND column_name = 'cancelled_by') THEN
    ALTER TABLE payment_mandates ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_mandates' AND column_name = 'cancellation_reason') THEN
    ALTER TABLE payment_mandates ADD COLUMN cancellation_reason TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_mandates' AND column_name = 'updated_at') THEN
    ALTER TABLE payment_mandates ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. TRANSACTIONS — add columns
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'gateway_response') THEN
    ALTER TABLE transactions ADD COLUMN gateway_response JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'fee') THEN
    ALTER TABLE transactions ADD COLUMN fee NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'net_amount') THEN
    ALTER TABLE transactions ADD COLUMN net_amount NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'description') THEN
    ALTER TABLE transactions ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'updated_at') THEN
    ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- End of migration 008
-- ════════════════════════════════════════════════════════════════════════════
