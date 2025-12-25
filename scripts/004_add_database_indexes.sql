-- Add indexes for frequently queried columns to improve query performance
-- Index on user_id for filtering expenses and months by user
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_months_user_id ON months(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_id ON goal_contributions(user_id);

-- Index on month_id for filtering expenses by month
CREATE INDEX IF NOT EXISTS idx_expenses_month_id ON expenses(month_id);

-- Index on month_year for quick month lookups
CREATE INDEX IF NOT EXISTS idx_months_month_year ON months(month_year);

-- Composite index for common query patterns (user_id + month_year)
CREATE INDEX IF NOT EXISTS idx_months_user_month ON months(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, month_id);

-- Index on expense_date for date range queries
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Index on category for category filtering
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Index on goal status for filtering active/completed goals
CREATE INDEX IF NOT EXISTS idx_savings_goals_status ON savings_goals(status);

-- Composite index for goal contributions (goal_id + contribution_date)
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_date ON goal_contributions(goal_id, contribution_date);

-- Add indexes for audit_logs table when created
-- Composite index for efficient audit log filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, action_date DESC) WHERE action_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
