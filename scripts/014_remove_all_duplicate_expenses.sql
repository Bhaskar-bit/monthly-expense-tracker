-- Remove ALL duplicate expenses created by the buggy recurring processor
-- Keep only the OLDEST (first created) expense per user, month, description, amount combination

WITH duplicates_cte AS (
  SELECT 
    e.id,
    e.user_id,
    e.description,
    e.amount,
    DATE_TRUNC('month', e.expense_date)::date as month,
    ROW_NUMBER() OVER (
      PARTITION BY 
        e.user_id,
        e.description,
        e.amount,
        DATE_TRUNC('month', e.expense_date)
      ORDER BY e.created_at ASC
    ) as rn
  FROM public.expenses e
  INNER JOIN public.recurring_expenses re 
    ON e.user_id = re.user_id 
    AND e.description = re.description
    AND e.category = re.category
)
DELETE FROM public.expenses
WHERE id IN (
  SELECT id FROM duplicates_cte 
  WHERE rn > 1
);

-- Reset last_created_date so recurring expenses can be properly tracked going forward
UPDATE public.recurring_expenses 
SET last_created_date = NULL
WHERE is_active = true;
