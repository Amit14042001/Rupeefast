-- ============================================================================
-- Migration 002 (DOWN): Remove all seed/development data
-- ============================================================================
--
-- Removes the sample data inserted by the UP migration, in reverse dependency
-- order (child tables first, then parents). Only deletes rows with IDs in the
-- seed range (1000-9999 for users, 2000-9999 for dependent tables).
-- ============================================================================

-- Child tables first (reverse dependency order)
DELETE FROM transactions     WHERE id BETWEEN 7000 AND 9999;
DELETE FROM payment_mandates WHERE id BETWEEN 6000 AND 9999;
DELETE FROM agent_tasks      WHERE id BETWEEN 5000 AND 9999;
DELETE FROM investments      WHERE id BETWEEN 4000 AND 9999;
DELETE FROM repayments       WHERE id BETWEEN 3000 AND 9999;
DELETE FROM loans            WHERE id BETWEEN 2000 AND 9999;
DELETE FROM users            WHERE id BETWEEN 1000 AND 9999;

-- Reset sequences back to their natural starting positions
SELECT setval('users_id_seq',             (SELECT COALESCE(MAX(id), 0) + 1 FROM users));
SELECT setval('loans_id_seq',             (SELECT COALESCE(MAX(id), 0) + 1 FROM loans));
SELECT setval('repayments_id_seq',        (SELECT COALESCE(MAX(id), 0) + 1 FROM repayments));
SELECT setval('investments_id_seq',       (SELECT COALESCE(MAX(id), 0) + 1 FROM investments));
SELECT setval('agent_tasks_id_seq',       (SELECT COALESCE(MAX(id), 0) + 1 FROM agent_tasks));
SELECT setval('payment_mandates_id_seq',  (SELECT COALESCE(MAX(id), 0) + 1 FROM payment_mandates));
SELECT setval('transactions_id_seq',      (SELECT COALESCE(MAX(id), 0) + 1 FROM transactions));
