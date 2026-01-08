-- Cleanup script to remove duplicate recurring expenses created by buggy processor
-- This script removes ALL expenses that were created from recurring expenses
-- You should manually verify this is what you want before running

-- First, let's identify and keep only the FIRST expense per recurring expense per month
-- Delete all duplicates by keeping only the oldest one per month per recurring expense
WITH duplicates_to_delete AS (
  SELECT e.id
  FROM expenses e
  INNER JOIN recurring_expenses r ON e.description = r.description
  WHERE r.is_active = true
  AND e.id NOT IN (
    -- Keep only the first (oldest) expense created for each recurring expense in each month
    SELECT DISTINCT ON (e2.user_id, DATE_TRUNC('month', e2.expense_date)::date, e2.description, e2.amount) e2.id
    FROM expenses e2
    WHERE e2.description IN (SELECT description FROM recurring_expenses WHERE is_active = true)
    ORDER BY e2.user_id, DATE_TRUNC('month', e2.expense_date)::date, e2.description, e2.amount, e2.created_at ASC
  )
)
DELETE FROM expenses
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Reset all recurring expenses tracking so they can be created fresh
UPDATE recurring_expenses
SET last_created_date = NULL
WHERE is_active = true;
