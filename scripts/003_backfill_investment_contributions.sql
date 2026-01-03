-- Backfill goal contributions from existing Investment category expenses
-- This script distributes all Investment expenses equally across active savings goals

WITH user_investment_expenses AS (
  -- Get all Investment category expenses that haven't been distributed yet
  SELECT 
    e.id,
    e.user_id,
    e.amount,
    e.expense_date,
    COUNT(DISTINCT sg.id) as goal_count
  FROM expenses e
  LEFT JOIN savings_goals sg ON sg.user_id = e.user_id AND sg.status = 'active'
  WHERE e.category = 'Investments'
    AND NOT EXISTS (
      SELECT 1 FROM goal_contributions gc WHERE gc.expense_id = e.id
    )
  GROUP BY e.id, e.user_id, e.amount, e.expense_date
  HAVING COUNT(DISTINCT sg.id) > 0
),
goal_distributions AS (
  -- Calculate distribution for each goal
  SELECT 
    uie.id as expense_id,
    uie.user_id,
    sg.id as goal_id,
    uie.amount / uie.goal_count as amount_per_goal,
    uie.expense_date
  FROM user_investment_expenses uie
  JOIN savings_goals sg ON sg.user_id = uie.user_id AND sg.status = 'active'
)
INSERT INTO goal_contributions (id, user_id, goal_id, expense_id, amount, contribution_date, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  user_id,
  goal_id,
  expense_id,
  amount_per_goal,
  contribution_date,
  NOW(),
  NOW()
FROM goal_distributions;

-- Update savings goals with the new contribution amounts
WITH contribution_sums AS (
  SELECT 
    goal_id,
    SUM(amount) as total_contributions
  FROM goal_contributions
  WHERE goal_id IN (SELECT id FROM savings_goals WHERE status = 'active')
  GROUP BY goal_id
)
UPDATE savings_goals
SET current_amount = COALESCE(current_amount, 0) + COALESCE(cs.total_contributions, 0)
FROM contribution_sums cs
WHERE savings_goals.id = cs.goal_id
  AND savings_goals.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM goal_contributions WHERE goal_id = savings_goals.id AND contribution_date IS NOT NULL LIMIT 1
  );
