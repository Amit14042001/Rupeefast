-- ============================================================================
-- Migration 001: Create initial database schema
-- ============================================================================
--
-- Creates all core RupeeFast tables: users, loans, repayments, investments,
-- agent_tasks, payment_mandates, and transactions.
--
-- This migration IS idempotent — it can be run multiple times safely because
-- every DDL statement uses IF NOT EXISTS.
-- ============================================================================

-- ── 1. USERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  mobile        TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT CHECK(role IN ('borrower', 'investor', 'agent', 'admin')),
  kyc_status    TEXT DEFAULT 'pending',
  trust_score   INTEGER DEFAULT 50,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── 2. LOANS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id              SERIAL PRIMARY KEY,
  borrower_id     INTEGER NOT NULL,
  amount          NUMERIC NOT NULL,
  repayment_plan  TEXT,
  purpose         TEXT,
  status          TEXT DEFAULT 'applied',
  disbursed_at    TIMESTAMP,
  total_to_repay  NUMERIC,
  remaining_balance NUMERIC,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(borrower_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- ── 3. REPAYMENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repayments (
  id        SERIAL PRIMARY KEY,
  loan_id   INTEGER NOT NULL,
  amount    NUMERIC NOT NULL,
  status    TEXT DEFAULT 'pending',
  due_date  DATE NOT NULL,
  paid_at   TIMESTAMP,
  method    TEXT,
  agent_id  INTEGER,
  FOREIGN KEY(loan_id) REFERENCES loans(id),
  FOREIGN KEY(agent_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_repayments_loan ON repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_repayments_due ON repayments(due_date);

-- ── 4. INVESTMENTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id           SERIAL PRIMARY KEY,
  investor_id  INTEGER NOT NULL,
  amount       NUMERIC NOT NULL,
  risk_bucket  TEXT,
  status       TEXT DEFAULT 'active',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(investor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_investments_investor ON investments(investor_id);

-- ── 5. AGENT_TASKS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
  id             SERIAL PRIMARY KEY,
  agent_id       INTEGER NOT NULL,
  target_user_id INTEGER,
  loan_id        INTEGER,
  task_type      TEXT CHECK(task_type IN ('verify', 'collect', 'recover')),
  status         TEXT DEFAULT 'pending',
  location_lat   NUMERIC,
  location_lng   NUMERIC,
  otp_verified   BOOLEAN DEFAULT FALSE,
  completed_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);

-- ── 6. PAYMENT_MANDATES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_mandates (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL,
  loan_id                 INTEGER,
  razorpay_subscription_id TEXT,
  razorpay_plan_id        TEXT,
  method                  TEXT CHECK(method IN ('upi_autopay', 'nach', 'agent')),
  status                  TEXT DEFAULT 'pending',
  amount                  NUMERIC NOT NULL,
  frequency               TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly')),
  total_cycles            INTEGER DEFAULT 100,
  remaining_cycles        INTEGER DEFAULT 100,
  activated_at            TIMESTAMP,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mandates_user ON payment_mandates(user_id);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON payment_mandates(status);
CREATE INDEX IF NOT EXISTS idx_mandates_subscription ON payment_mandates(razorpay_subscription_id);

-- ── 7. TRANSACTIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                        SERIAL PRIMARY KEY,
  mandate_id                INTEGER,
  user_id                   INTEGER NOT NULL,
  loan_id                   INTEGER,
  razorpay_payment_id       TEXT,
  razorpay_subscription_id  TEXT,
  amount                    NUMERIC NOT NULL,
  type                      TEXT CHECK(type IN ('repayment', 'disbursal', 'investment', 'withdrawal', 'refund')),
  status                    TEXT DEFAULT 'pending',
  method                    TEXT,
  notes                     TEXT,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
