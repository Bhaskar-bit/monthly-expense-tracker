-- Add return tracking columns to savings goals
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS projected_return_rate DECIMAL(5, 2); -- Annual percentage
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS actual_returns DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS return_note TEXT;

-- Create investment returns tracking table
CREATE TABLE IF NOT EXISTS investment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  return_amount DECIMAL(10, 2) NOT NULL,
  return_date DATE NOT NULL,
  return_source TEXT, -- e.g., 'interest', 'dividend', 'capital_appreciation', 'manual_entry'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE investment_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own returns"
  ON investment_returns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own returns"
  ON investment_returns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own returns"
  ON investment_returns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own returns"
  ON investment_returns FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_investment_returns_goal ON investment_returns(goal_id);
CREATE INDEX idx_investment_returns_date ON investment_returns(return_date);
