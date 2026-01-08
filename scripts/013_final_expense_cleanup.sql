-- Final cleanup: Remove ALL duplicate recurring expenses completely
-- This script will identify and delete every duplicate while keeping only one per month

-- First, let's identify and delete all duplicates
-- We keep only the FIRST (oldest) expense per month per description
WITH duplicates_to_delete AS (
  SELECT 
    e.id,
    e.user_id,
    e.description,
    DATE_TRUNC('month', e.expense_date)::date as expense_month,
    ROW_NUMBER() OVER (
      PARTITION BY 
        e.user_id,
        e.description,
        DATE_TRUNC('month', e.expense_date)::date
      ORDER BY e.created_at ASC
    ) as occurrence_number
  FROM public.expenses e
  WHERE e.user_id = (SELECT user_id FROM public.recurring_expenses LIMIT 1)
    AND e.description IN (
      SELECT description FROM public.recurring_expenses 
      WHERE is_active = true
    )
)
DELETE FROM public.expenses
WHERE id IN (
  SELECT id FROM duplicates_to_delete 
  WHERE occurrence_number > 1
);

-- Reset the recurring expense tracking so new processing starts fresh
UPDATE public.recurring_expenses 
SET last_created_date = NULL
WHERE is_active = true;
