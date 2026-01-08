-- Remove ALL expenses created from broken recurring processor
-- This will delete all duplicate recurring expenses, keeping your manual expenses intact
-- Strategy: Delete all duplicates, keeping only the oldest one per recurring expense per month

-- Step 1: Delete ALL expenses that match active recurring expense descriptions
-- Keep only the earliest one per recurring expense per month
WITH duplicates AS (
  SELECT 
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.description, DATE_TRUNC('month', e.expense_date)::date 
      ORDER BY e.created_at ASC
    ) as rn
  FROM public.expenses e
  WHERE e.description IN (SELECT DISTINCT description FROM public.recurring_expenses WHERE is_active = true)
)
DELETE FROM public.expenses 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Reset last_created_date for all recurring expenses so they can be properly scheduled
UPDATE public.recurring_expenses 
SET last_created_date = NULL, updated_at = NOW()
WHERE is_active = true;

-- Step 3: Recalculate carryover for all months to fix totals
UPDATE public.months m
SET carryover_from_previous = COALESCE((
  SELECT inflow - COALESCE(SUM(amount), 0)
  FROM public.months prev
  LEFT JOIN public.expenses e ON prev.id = e.month_id
  WHERE prev.month_year = (m.month_year - INTERVAL '1 month')::date
  GROUP BY prev.id, prev.inflow
), 0),
updated_at = NOW()
WHERE user_id = (SELECT user_id FROM public.recurring_expenses LIMIT 1);
