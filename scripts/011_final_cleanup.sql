-- Simple cleanup: Delete all duplicate recurring expenses
-- Keep only 1 expense per month per recurring expense description

-- Delete duplicates by keeping only the oldest
DELETE FROM public.expenses
WHERE id NOT IN (
  SELECT DISTINCT ON (description, DATE_TRUNC('month', expense_date)::date) id
  FROM public.expenses
  WHERE description IN (SELECT description FROM public.recurring_expenses WHERE is_active = true)
  ORDER BY description, DATE_TRUNC('month', expense_date)::date, created_at ASC
)
AND description IN (SELECT description FROM public.recurring_expenses WHERE is_active = true);

-- Reset last_created_date to allow fresh processing
UPDATE public.recurring_expenses 
SET last_created_date = NULL
WHERE is_active = true;
