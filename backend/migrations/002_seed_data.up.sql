-- ============================================================================
-- Migration 002: Seed development/test data
-- ============================================================================
--
-- Populates the database with sample users, loans, repayments, investments,
-- agent tasks, payment mandates, and transactions. All IDs are explicit so
-- relationships are predictable and reproducible across environments.
--
-- The migration uses ON CONFLICT for idempotency — re-running is safe.
-- After inserting seed rows, sequences are reset to avoid collision with
-- future application-generated rows.
--
-- Usage:
--   NODE_ENV=development node src/migrate.js up    # applies seed data
--   NODE_ENV=development node src/migrate.js down   # removes seed data
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1. USERS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO users (id, mobile, name, role, kyc_status, trust_score, created_at)
VALUES
  (1001, '9876543210', 'Ravi Kumar',   'borrower', 'verified', 72, '2025-01-15 10:30:00'),
  (1002, '9876543211', 'Sneha Patel',  'borrower', 'pending',  45, '2025-02-01 09:00:00'),
  (1003, '9876543212', 'Arjun Verma',  'borrower', 'verified', 88, '2025-01-20 14:00:00'),
  (1004, '9876543213', 'Priya Sharma', 'investor', 'verified', 85, '2025-01-10 11:00:00'),
  (1005, '9876543214', 'Meera Reddy',  'investor', 'pending',  60, '2025-02-15 16:00:00'),
  (1006, '9876543215', 'Vikram Singh', 'agent',    'verified', 90, '2025-01-05 08:00:00'),
  (1007, '9876543216', 'Deepak Joshi', 'agent',    'pending',  55, '2025-02-20 12:00:00'),
  (1008, '9876543217', 'Admin User',   'admin',    'verified', NULL, '2025-01-01 00:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LOANS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO loans (id, borrower_id, amount, repayment_plan, purpose, status, disbursed_at, total_to_repay, remaining_balance, created_at)
VALUES
  -- Ravi: active daily loan — ₹10,000 principal, 20% markup = ₹12,000, daily ₹120 x 100 days
  (2001, 1001, 10000, 'Daily',   'Kirana shop inventory',     'active',    '2025-02-01 09:00:00', 12000, 8400, '2025-01-28 10:00:00'),
  -- Ravi: completed loan — paid off in full
  (2002, 1001, 5000,  'Monthly', 'Home repair',               'completed', '2024-06-01 09:00:00', 6000,  0,    '2024-05-25 10:00:00'),
  -- Sneha: active weekly loan — ₹8,000 principal, 18% markup = ₹9,440, weekly ₹1,180 x 8 weeks, 2 paid, 6 remaining
  (2003, 1002, 8000,  'Weekly',  'Tailoring business setup',  'active',    '2025-02-10 09:00:00', 9440, 7080, '2025-02-05 10:00:00'),
  -- Arjun: active monthly loan — ₹15,000 principal, 18% markup = ₹17,700, monthly ₹1,475 x 12 months, 2 paid via NACH, 10 remaining
  (2004, 1003, 15000, 'Monthly', 'Farm equipment purchase',   'active',    '2025-02-15 09:00:00', 17700, 14750, '2025-02-10 10:00:00'),
  -- Sneha: new application — not yet disbursed
  (2005, 1002, 3000,  'Weekly',  'Emergency medical expense', 'applied',   NULL,               NULL,  NULL,  '2025-03-01 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. REPAYMENTS
-- ════════════════════════════════════════════════════════════════════════════

-- Loan 2001 (Ravi, Daily plan — 30 repayments so far: 15 paid, 15 pending)
INSERT INTO repayments (id, loan_id, amount, status, due_date, paid_at, method, agent_id)
VALUES
  (3001,  2001, 120, 'paid',   '2025-02-01', '2025-02-01 08:00:00', 'upi_autopay', NULL),
  (3002,  2001, 120, 'paid',   '2025-02-02', '2025-02-02 08:00:00', 'upi_autopay', NULL),
  (3003,  2001, 120, 'paid',   '2025-02-03', '2025-02-03 08:00:00', 'upi_autopay', NULL),
  (3004,  2001, 120, 'paid',   '2025-02-04', '2025-02-04 08:00:00', 'upi_autopay', NULL),
  (3005,  2001, 120, 'paid',   '2025-02-05', '2025-02-05 08:00:00', 'upi_autopay', NULL),
  (3006,  2001, 120, 'paid',   '2025-02-06', '2025-02-06 08:00:00', 'upi_autopay', NULL),
  (3007,  2001, 120, 'paid',   '2025-02-07', '2025-02-07 08:00:00', 'upi_autopay', NULL),
  (3008,  2001, 120, 'paid',   '2025-02-08', '2025-02-08 08:00:00', 'upi_autopay', NULL),
  (3009,  2001, 120, 'paid',   '2025-02-09', '2025-02-09 08:00:00', 'upi_autopay', NULL),
  (3010,  2001, 120, 'paid',   '2025-02-10', '2025-02-10 08:00:00', 'upi_autopay', NULL),
  (3011,  2001, 120, 'paid',   '2025-02-11', '2025-02-11 08:00:00', 'upi_autopay', NULL),
  (3012,  2001, 120, 'paid',   '2025-02-12', '2025-02-12 08:00:00', 'upi_autopay', NULL),
  (3013,  2001, 120, 'paid',   '2025-02-13', '2025-02-13 08:00:00', 'agent', 1006),
  (3014,  2001, 120, 'paid',   '2025-02-14', '2025-02-14 08:00:00', 'agent', 1006),
  (3015,  2001, 120, 'paid',   '2025-02-15', '2025-02-15 08:00:00', 'agent', 1006),
  (3016,  2001, 120, 'pending', '2025-02-16', NULL, NULL, NULL),
  (3017,  2001, 120, 'pending', '2025-02-17', NULL, NULL, NULL),
  (3018,  2001, 120, 'pending', '2025-02-18', NULL, NULL, NULL),
  (3019,  2001, 120, 'pending', '2025-02-19', NULL, NULL, NULL),
  (3020,  2001, 120, 'pending', '2025-02-20', NULL, NULL, NULL),
  (3021,  2001, 120, 'pending', '2025-02-21', NULL, NULL, NULL),
  (3022,  2001, 120, 'pending', '2025-02-22', NULL, NULL, NULL),
  (3023,  2001, 120, 'pending', '2025-02-23', NULL, NULL, NULL),
  (3024,  2001, 120, 'pending', '2025-02-24', NULL, NULL, NULL),
  (3025,  2001, 120, 'pending', '2025-02-25', NULL, NULL, NULL),
  (3026,  2001, 120, 'pending', '2025-02-26', NULL, NULL, NULL),
  (3027,  2001, 120, 'pending', '2025-02-27', NULL, NULL, NULL),
  (3028,  2001, 120, 'pending', '2025-02-28', NULL, NULL, NULL),
  (3029,  2001, 120, 'pending', '2025-03-01', NULL, NULL, NULL),
  (3030,  2001, 120, 'pending', '2025-03-02', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Loan 2002 (Ravi, completed — 6 monthly repayments at ₹1,000 each, all paid)
INSERT INTO repayments (id, loan_id, amount, status, due_date, paid_at, method)
VALUES
  (3031, 2002, 1000, 'paid', '2024-07-01', '2024-07-01 09:00:00', 'upi_autopay'),
  (3032, 2002, 1000, 'paid', '2024-08-01', '2024-08-01 09:00:00', 'upi_autopay'),
  (3033, 2002, 1000, 'paid', '2024-09-01', '2024-09-01 09:00:00', 'upi_autopay'),
  (3034, 2002, 1000, 'paid', '2024-10-01', '2024-10-01 09:00:00', 'upi_autopay'),
  (3035, 2002, 1000, 'paid', '2024-11-01', '2024-11-01 09:00:00', 'upi_autopay'),
  (3036, 2002, 1000, 'paid', '2024-12-01', '2024-12-01 09:00:00', 'upi_autopay')
ON CONFLICT (id) DO NOTHING;

-- Loan 2003 (Sneha, Weekly plan — 2 paid weekly repayments at ₹1,180 each)
INSERT INTO repayments (id, loan_id, amount, status, due_date, paid_at, method)
VALUES
  (3037, 2003, 1180, 'paid', '2025-02-17', '2025-02-17 09:00:00', 'upi_autopay'),
  (3038, 2003, 1180, 'paid', '2025-02-24', '2025-02-24 09:00:00', 'agent', 1006)
ON CONFLICT (id) DO NOTHING;

-- Arjun's loan 2004 — repayments are charged via NACH (tracked in transactions 7007, 7008),
-- no separate repayment records needed since NACH charges map directly to transactions.

-- ════════════════════════════════════════════════════════════════════════════
-- 4. INVESTMENTS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO investments (id, investor_id, amount, risk_bucket, status, created_at)
VALUES
  (4001, 1004, 5000,  'safe',     'active',  '2025-01-20 10:00:00'),
  (4002, 1004, 3000,  'moderate', 'active',  '2025-02-01 11:00:00'),
  (4003, 1005, 10000, 'safe',     'active',  '2025-02-20 12:00:00'),
  (4004, 1005, 2000,  'high',     'pending', '2025-03-01 14:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. AGENT TASKS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO agent_tasks (id, agent_id, target_user_id, loan_id, task_type, status, location_lat, location_lng, otp_verified, completed_at, created_at)
VALUES
  -- Vikram: completed verification for Ravi
  (5001, 1006, 1001, 2001, 'verify',  'completed', 19.0760, 72.8777, TRUE,  '2025-02-01 10:30:00', '2025-02-01 09:00:00'),
  -- Vikram: completed collections from Ravi (agent-assisted payment)
  (5002, 1006, 1001, 2001, 'collect', 'completed', 19.0760, 72.8777, TRUE,  '2025-02-13 09:30:00', '2025-02-13 08:00:00'),
  (5003, 1006, 1001, 2001, 'collect', 'completed', 19.0760, 72.8777, TRUE,  '2025-02-14 09:30:00', '2025-02-14 08:00:00'),
  (5004, 1006, 1001, 2001, 'collect', 'completed', 19.0760, 72.8777, TRUE,  '2025-02-15 09:30:00', '2025-02-15 08:00:00'),
  -- Vikram: pending recovery for Sneha (overdue weekly loan)
  (5005, 1006, 1002, 2003, 'recover', 'pending',  19.0760, 72.8777, FALSE, NULL,                   '2025-03-02 08:00:00'),
  -- Deepak: pending verification for Arjun
  (5006, 1007, 1003, 2004, 'verify',  'pending',  28.6139, 77.2090, FALSE, NULL,                   '2025-02-10 09:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PAYMENT MANDATES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO payment_mandates (id, user_id, loan_id, razorpay_subscription_id, razorpay_plan_id, method, status, amount, frequency, total_cycles, remaining_cycles, activated_at, created_at)
VALUES
  -- Ravi's UPI AutoPay mandate for daily loan (100 cycles, 15 used = 85 remaining)
  (6001, 1001, 2001, 'sub_RfD1a2b3c4d5e6', 'plan_RfD1a2b3c4d5e6', 'upi_autopay', 'active',  120, 'daily',   100, 85, '2025-02-01 09:00:00', '2025-01-28 10:00:00'),
  -- Ravi's completed mandate (loan 2002 repaid in full)
  (6002, 1001, 2002, 'sub_RfOld1a2b3c4d5', 'plan_RfOld1a2b3c4d5',  'upi_autopay', 'completed', 1000, 'monthly', 6,  0,  '2024-06-01 09:00:00', '2024-05-25 10:00:00'),
  -- Arjun's NACH mandate for monthly loan (12 cycles, 2 used = 10 remaining)
  (6003, 1003, 2004, 'sub_RfA1b2c3d4e5f6', 'plan_RfA1b2c3d4e5f6', 'nach',        'active',  1475, 'monthly', 12, 10, '2025-02-15 09:00:00', '2025-02-10 10:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. TRANSACTIONS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO transactions (id, mandate_id, user_id, loan_id, razorpay_payment_id, razorpay_subscription_id, amount, type, status, method, notes, created_at)
VALUES
  -- Ravi's repayments via UPI AutoPay
  (7001, 6001, 1001, 2001, 'pay_RfD1a2b3c4d5e6', 'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'upi_autopay', '{"collected":true}', '2025-02-01 08:00:00'),
  (7002, 6001, 1001, 2001, 'pay_RfD1a2b3c4d5e7', 'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'upi_autopay', '{"collected":true}', '2025-02-02 08:00:00'),
  (7003, 6001, 1001, 2001, 'pay_RfD1a2b3c4d5e8', 'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'upi_autopay', '{"collected":true}', '2025-02-03 08:00:00'),
  -- Ravi's agent-assisted repayments
  (7004, 6001, 1001, 2001, 'pay_RfAgent01',       'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'agent',       '{"agent_id":1006}', '2025-02-13 09:30:00'),
  (7005, 6001, 1001, 2001, 'pay_RfAgent02',       'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'agent',       '{"agent_id":1006}', '2025-02-14 09:30:00'),
  (7006, 6001, 1001, 2001, 'pay_RfAgent03',       'sub_RfD1a2b3c4d5e6', 120, 'repayment', 'completed', 'agent',       '{"agent_id":1006}', '2025-02-15 09:30:00'),
  -- Arjun's NACH repayments (2 of 12 charged so far)
  (7007, 6003, 1003, 2004, 'pay_RfNACH01',        'sub_RfA1b2c3d4e5f6', 1475, 'repayment', 'completed', 'nach',        NULL,                 '2025-03-01 09:00:00'),
  (7008, 6003, 1003, 2004, 'pay_RfNACH02',        'sub_RfA1b2c3d4e5f6', 1475, 'repayment', 'completed', 'nach',        NULL,                 '2025-04-01 09:00:00'),
  -- Ravi's loan disbursal
  (7009, NULL, 1001, 2001, 'pay_RfDisburse01',    NULL,                  10000, 'disbursal', 'completed', 'bank_transfer', '{"purpose":"disbursal"}', '2025-02-01 09:00:00'),
  -- Priya's investments
  (7010, NULL, 1004, NULL, 'pay_RfInv01',         NULL,                  5000, 'investment', 'completed', 'upi',         '{"risk":"safe"}', '2025-01-20 10:00:00'),
  (7011, NULL, 1004, NULL, 'pay_RfInv02',         NULL,                  3000, 'investment', 'completed', 'upi',         '{"risk":"moderate"}', '2025-02-01 11:00:00'),
  -- Ravi's previous loan repayments (completed)
  (7012, 6002, 1001, 2002, 'pay_RfOld01',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-07-01 09:00:00'),
  (7013, 6002, 1001, 2002, 'pay_RfOld02',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-08-01 09:00:00'),
  (7014, 6002, 1001, 2002, 'pay_RfOld03',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-09-01 09:00:00'),
  (7015, 6002, 1001, 2002, 'pay_RfOld04',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-10-01 09:00:00'),
  (7016, 6002, 1001, 2002, 'pay_RfOld05',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-11-01 09:00:00'),
  (7017, 6002, 1001, 2002, 'pay_RfOld06',         'sub_RfOld1a2b3c4d5', 1000, 'repayment', 'completed', 'upi_autopay', NULL, '2024-12-01 09:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. NOTIFICATION TEMPLATES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO notification_templates (id, name, label, channel, subject, body, variables, is_active, created_by, created_at)
VALUES
  (8001, 'emi_reminder',     'EMI Reminder',            'sms', NULL,
    'Hi {{name}}, your EMI of ₹{{amount}} is due on {{due_date}}. Pay now to avoid late fees. - RupeeFast',
    '["name","amount","due_date"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8002, 'payment_success',  'Payment Confirmation',    'push', 'Payment Successful',
    'Your payment of ₹{{amount}} has been received. Thank you!',
    '["amount"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8003, 'kyc_approved',     'KYC Approved',            'whatsapp', 'KYC Verified',
    '✅ *KYC Approved!*

Dear {{name}},
Your KYC verification has been approved. You can now apply for loans up to ₹{{loan_limit}}.

- RupeeFast Team',
    '["name","loan_limit"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8004, 'kyc_rejected',     'KYC Rejected',            'sms', NULL,
    'Hi {{name}}, your KYC documents need re-submission. Reason: {{reason}}. Please upload fresh documents. - RupeeFast',
    '["name","reason"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8005, 'loan_approved',    'Loan Approved',           'push', 'Loan Approved 🎉',
    'Congratulations {{name}}! Your loan of ₹{{amount}} has been approved. It will be disbursed shortly.',
    '["name","amount"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8006, 'overdue_reminder', 'Overdue Payment Warning', 'sms', NULL,
    'URGENT: {{name}}, your loan payment of ₹{{amount}} is {{days_overdue}} days overdue. Pay immediately to avoid penalty & credit score impact. - RupeeFast',
    '["name","amount","days_overdue"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8007, 'promo_offer',      'Special Offer',            'sms', NULL,
    'Hi {{name}}, get a loan of up to ₹{{limit}} at just {{rate}}% interest! Limited time offer. Apply now on RupeeFast.',
    '["name","limit","rate"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8008, 'referral_reward',  'Referral Reward',          'push', 'You Earned ₹{{amount}}!',
    'Your referral {{friend_name}} just joined RupeeFast. You earned ₹{{amount}} as a reward!',
    '["amount","friend_name"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8009, 'investor_update',  'Investment Update',        'whatsapp', 'Portfolio Update',
    '📊 *Portfolio Update*

Dear {{name}},
Your investments have earned ₹{{earnings}} this month. Total portfolio: ₹{{portfolio_value}}.

- RupeeFast Investments',
    '["name","earnings","portfolio_value"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00'),
  (8010, 'agent_task',       'New Agent Task',           'push', 'New Task Assigned',
    'You have a new {{task_type}} task for {{customer_name}} at {{location}}. Check your tasks dashboard.',
    '["task_type","customer_name","location"]'::jsonb, TRUE, 1008, '2025-01-01 00:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. SAMPLE BROADCASTS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO notification_broadcasts (id, template_id, title, message, channels, target_filters, total_recipients, sent_count, delivered_count, failed_count, opened_count, status, sent_at, completed_at, created_by, created_at)
VALUES
  (9001, 8002, 'Payment Confirmation',
    'Your payment of ₹120 has been received. Thank you!',
    '["push"]'::jsonb,
    '{"roles":["borrower"]}'::jsonb,
    3, 3, 3, 0, 2, 'sent', '2025-02-01 08:00:00', '2025-02-01 08:01:00', 1008, '2025-02-01 07:55:00'),
  (9002, 8001, 'EMI Reminder Batch',
    'Hi {{name}}, your EMI of ₹120 is due on 2025-02-16. Pay now to avoid late fees.',
    '["sms","push"]'::jsonb,
    '{"roles":["borrower"],"kyc_status":"verified"}'::jsonb,
    2, 2, 2, 0, 1, 'sent', '2025-02-15 09:00:00', '2025-02-15 09:02:00', 1008, '2025-02-14 10:00:00'),
  (9003, 8007, 'Festival Offer Blast',
    'Hi {{name}}, get a loan of up to ₹50,000 at just 12% interest! Limited time Diwali offer.',
    '["sms","whatsapp"]'::jsonb,
    '{"roles":["borrower","investor"]}'::jsonb,
    5, 4, 3, 1, 0, 'partial', '2025-03-01 10:00:00', '2025-03-01 10:05:00', 1008, '2025-02-28 12:00:00'),
  (9004, 8010, 'Agent Assignment',
    'You have a new recovery task for Sneha Patel at Andheri, Mumbai.',
    '["push"]'::jsonb,
    '{"roles":["agent"]}'::jsonb,
    2, 2, 2, 0, 2, 'sent', '2025-03-02 08:00:00', '2025-03-02 08:00:30', 1008, '2025-03-02 07:55:00'),
  (9005, 8009, 'Monthly Investor Digest',
    'Dear {{name}}, your investments have earned ₹1,455 this month. Total portfolio: ₹8,000.',
    '["whatsapp","push"]'::jsonb,
    '{"roles":["investor"]}'::jsonb,
    2, 2, 1, 1, 0, 'partial', '2025-03-01 09:00:00', '2025-03-01 09:01:00', 1008, '2025-02-28 16:00:00')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. RESET SEQUENCES — prevent ID collision with app-generated rows
-- ════════════════════════════════════════════════════════════════════════════

SELECT setval('users_id_seq',             (SELECT COALESCE(MAX(id), 0) + 1 FROM users));
SELECT setval('loans_id_seq',             (SELECT COALESCE(MAX(id), 0) + 1 FROM loans));
SELECT setval('repayments_id_seq',        (SELECT COALESCE(MAX(id), 0) + 1 FROM repayments));
SELECT setval('investments_id_seq',       (SELECT COALESCE(MAX(id), 0) + 1 FROM investments));
SELECT setval('agent_tasks_id_seq',       (SELECT COALESCE(MAX(id), 0) + 1 FROM agent_tasks));
SELECT setval('payment_mandates_id_seq',  (SELECT COALESCE(MAX(id), 0) + 1 FROM payment_mandates));
SELECT setval('transactions_id_seq',              (SELECT COALESCE(MAX(id), 0) + 1 FROM transactions));
SELECT setval('notification_templates_id_seq',  (SELECT COALESCE(MAX(id), 0) + 1 FROM notification_templates));
SELECT setval('notification_broadcasts_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM notification_broadcasts));

-- ============================================================================
-- End of seed data migration
-- ============================================================================
