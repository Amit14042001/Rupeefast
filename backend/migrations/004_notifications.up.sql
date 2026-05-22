-- ============================================================================
-- Migration 004: Notification Broadcasting System
-- ============================================================================
--
-- Creates tables for:
--   1. notification_templates — Pre-defined message templates for SMS, WhatsApp,
--      and in-app push notifications with variable substitution support.
--   2. notification_broadcasts — Records of sent/received broadcasts along with
--      per-channel delivery analytics (sent, delivered, failed counts).
--
-- ============================================================================

-- ── 1. NOTIFICATION TEMPLATES ───────────────────────────────────────────────
--
-- Each template is tied to a specific channel (sms / whatsapp / push) and
-- contains the message body with {{variable}} placeholders. The `variables`
-- column lists which variables the template expects.
--
-- Examples:
--   Channel: sms
--     Body: "Hi {{name}}, your EMI of ₹{{amount}} is due on {{due_date}}."
--     Variables: ["name", "amount", "due_date"]
--
--   Channel: whatsapp
--     Body: "📢 *Payment Reminder*\n\nDear {{name}},\nYour EMI of ₹{{amount}} is due."
--     Variables: ["name", "amount"]
--
--   Channel: push
--     Body: "EMI Reminder — ₹{{amount}} due tomorrow"
--     Variables: ["amount"]

CREATE TABLE IF NOT EXISTS notification_templates (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,                           -- e.g. 'emi_reminder', 'kyc_approved'
  label         TEXT NOT NULL,                           -- Human-readable: 'EMI Reminder'
  channel       TEXT NOT NULL CHECK(channel IN ('sms', 'whatsapp', 'push')),
  subject       TEXT,                                    -- Used for push notification title (optional for SMS/WhatsApp)
  body          TEXT NOT NULL,                           -- Message body with {{variable}} placeholders
  variables     JSONB DEFAULT '[]'::jsonb,               -- Array of variable names: ["name","amount","due_date"]
  is_active     BOOLEAN DEFAULT TRUE,                    -- Soft-disable without deleting
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notif_templates_active ON notification_templates(is_active);

-- ── 2. NOTIFICATION BROADCASTS ──────────────────────────────────────────────
--
-- Records every broadcast sent through the system. Tracks target criteria,
-- channel-level delivery stats, and the full lifecycle (draft → sending → sent).
--
-- `target_filters` stores criteria as JSONB:
--   { "roles": ["borrower"], "kyc_status": "verified", "min_trust_score": 50 }
--
-- `channels` stores which channels this broadcast used:
--   ["sms", "whatsapp", "push"]

CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER REFERENCES notification_templates(id),
  title           TEXT NOT NULL,                          -- Campaign title for admin reference
  message         TEXT NOT NULL,                          -- Rendered message (variables substituted)
  channels        JSONB NOT NULL DEFAULT '["push"]'::jsonb, -- ["sms","whatsapp","push"]
  target_filters  JSONB DEFAULT '{}'::jsonb,              -- { "roles": [...], "kyc_status": "...", ... }

  -- Target & delivery stats
  total_recipients    INTEGER DEFAULT 0,
  sent_count          INTEGER DEFAULT 0,
  delivered_count     INTEGER DEFAULT 0,
  failed_count        INTEGER DEFAULT 0,
  opened_count        INTEGER DEFAULT 0,                  -- Push notification opens / SMS link clicks

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'sent', 'partial', 'cancelled')),
  scheduled_for   TIMESTAMP,                              -- For scheduled (future) broadcasts
  sent_at         TIMESTAMP,
  completed_at    TIMESTAMP,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_broadcasts_status ON notification_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_notif_broadcasts_created ON notification_broadcasts(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_broadcasts_template ON notification_broadcasts(template_id);

-- ============================================================================
-- End of migration 004
-- ============================================================================
