-- Complete cleanup of duplicate recurring expenses
-- This script removes all duplicates while keeping one per month per recurring description

-- Step 1: Delete all duplicate expenses created from recurring sources
-- Keep only the oldest one per month per description
DELETE FROM public.expenses
WHERE id IN (
  SELECT id FROM (
    SELECT 
      e.id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          EXTRACT(YEAR FROM e.expense_date)::text || '-' || LPAD(EXTRACT(MONTH FROM e.expense_date)::text, 2, '0'),
          e.description
        ORDER BY e.created_at ASC
      ) as rn
    FROM public.expenses e
    WHERE e.description IN (
      SELECT description FROM public.recurring_expenses WHERE is_active = true
    )
  ) AS ranked
  WHERE rn > 1
);

-- Step 2: Reset last_created_date to allow fresh processing
UPDATE public.recurring_expenses 
SET last_created_date = NULL
WHERE is_active = true;

-- Step 3: Recalculate total expenses for each month
-- This ensures carryover calculations are correct
UPDATE public.months m
SET 
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.expenses e 
  WHERE e.user_id = m.user_id 
    AND DATE_TRUNC('month', e.expense_date)::date = m.month_year
);
