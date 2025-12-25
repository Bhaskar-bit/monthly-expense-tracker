-- Create budget limits table
CREATE TABLE IF NOT EXISTS budget_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  monthly_limit DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Create budget alerts table
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year DATE NOT NULL,
  category TEXT NOT NULL,
  spent_amount DECIMAL(10, 2) NOT NULL,
  budget_limit DECIMAL(10, 2) NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('warning', 'exceeded')),
  is_acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE budget_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budgets"
  ON budget_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budgets"
  ON budget_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budgets"
  ON budget_limits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budgets"
  ON budget_limits FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts"
  ON budget_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own alerts"
  ON budget_alerts FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_budget_limits_user ON budget_limits(user_id);
CREATE INDEX idx_budget_alerts_user_month ON budget_alerts(user_id, month_year);
