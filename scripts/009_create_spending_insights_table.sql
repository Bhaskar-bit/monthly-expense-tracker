-- Create spending insights cache table to store analytics data
CREATE TABLE IF NOT EXISTS spending_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year DATE NOT NULL,
  category TEXT NOT NULL,
  total_spent DECIMAL(10, 2) NOT NULL,
  transaction_count INTEGER DEFAULT 0,
  average_transaction DECIMAL(10, 2),
  month_over_month_change DECIMAL(5, 2), -- percentage change from previous month
  year_over_year_change DECIMAL(5, 2), -- percentage change from previous year
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year, category)
);

-- Enable Row Level Security
ALTER TABLE spending_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own insights"
  ON spending_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights"
  ON spending_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
  ON spending_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_spending_insights_user_month ON spending_insights(user_id, month_year);
CREATE INDEX idx_spending_insights_category ON spending_insights(category);
