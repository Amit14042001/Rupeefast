-- ============================================================================
-- Migration 005: Enhanced Loan Approval Workflow
-- ============================================================================
--
-- Adds:
--   admin_roles        — Admin seniority levels & approval limits
--   loan_reviews       — Multi-step review tracking (credit_check, risk_assessment, document_validation, final_approval)
--   loan_documents     — Per-loan document validation tracking
--   loan_status        — New ENUM-like statuses via CHECK constraint (loans.status expanded)
--
-- ============================================================================

-- ── 1. ADMIN ROLES & APPROVAL LIMITS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_roles (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_level      INTEGER NOT NULL DEFAULT 1 CHECK(role_level BETWEEN 1 AND 5),
  title           TEXT NOT NULL DEFAULT 'Junior Admin',
  approval_limit  NUMERIC NOT NULL DEFAULT 10000,
  can_approve     BOOLEAN DEFAULT TRUE,
  can_disburse    BOOLEAN DEFAULT FALSE,
  can_override    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_user ON admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_level ON admin_roles(role_level);

-- ── 2. LOAN REVIEW STEPS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_reviews (
  id            SERIAL PRIMARY KEY,
  loan_id       INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  step          TEXT NOT NULL CHECK(step IN ('credit_check', 'risk_assessment', 'document_validation', 'final_approval')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'passed', 'failed', 'skipped')),
  reviewer_id   INTEGER REFERENCES users(id),
  notes         TEXT,
  metadata      JSONB DEFAULT '{}',
  completed_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(loan_id, step)
);

CREATE INDEX IF NOT EXISTS idx_loan_reviews_loan ON loan_reviews(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_reviews_step ON loan_reviews(step);
CREATE INDEX IF NOT EXISTS idx_loan_reviews_status ON loan_reviews(status);

-- ── 3. LOAN DOCUMENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_documents (
  id            SERIAL PRIMARY KEY,
  loan_id       INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  doc_type      TEXT NOT NULL CHECK(doc_type IN ('aadhaar', 'pan', 'bank_statement', 'income_proof', 'address_proof', 'photo', 'signature', 'other')),
  doc_url       TEXT,
  status        TEXT NOT NULL DEFAULT 'not_submitted' CHECK(status IN ('not_submitted', 'pending', 'verified', 'rejected', 'expired')),
  verified_by   INTEGER REFERENCES users(id),
  verified_at   TIMESTAMP,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_documents_loan ON loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_documents_type ON loan_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_loan_documents_status ON loan_documents(status);

-- ── 4. UPDATE LOAN STATUSES ──────────────────────────────────────────────────
-- Widen the status CHECK to include new workflow states.
-- Since we can't ALTER a CHECK constraint directly in older PG, we'll run a
-- safe column operation. The loans table already has a TEXT column with no
-- CHECK in some deployments — we add the constraint if not present.
DO $$
BEGIN
  -- Drop the old constraint if it exists (safe operation)
  ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Add the broader constraint (this may fail on existing data — that's expected)
ALTER TABLE loans ADD CONSTRAINT loans_status_check
  CHECK (status IN (
    'applied',
    'credit_check',
    'risk_assessment',
    'document_validation',
    'approved',
    'rejected',
    'disbursed',
    'active',
    'overdue',
    'completed',
    'defaulted'
  ));

-- ── 5. LOAN_REVIEWERS JUNCTION (who can review which loans) ──────────────────
CREATE TABLE IF NOT EXISTS loan_reviewers (
  id              SERIAL PRIMARY KEY,
  loan_id         INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  admin_id        INTEGER NOT NULL REFERENCES users(id),
  assigned_step   TEXT NOT NULL CHECK(assigned_step IN ('credit_check', 'risk_assessment', 'document_validation', 'final_approval')),
  assigned_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(loan_id, assigned_step)
);

CREATE INDEX IF NOT EXISTS idx_loan_reviewers_loan ON loan_reviewers(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_reviewers_admin ON loan_reviewers(admin_id);

-- ── 6. SEED ADMIN ROLES ──────────────────────────────────────────────────────
INSERT INTO admin_roles (user_id, role_level, title, approval_limit, can_approve, can_disburse, can_override)
SELECT u.id, 3, 'Super Admin', 100000, TRUE, TRUE, TRUE
FROM users u WHERE u.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM admin_roles ar WHERE ar.user_id = u.id);
