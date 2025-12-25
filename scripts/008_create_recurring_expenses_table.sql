-- Create recurring expenses table
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Investments',
    'EMIs',
    'Monthly Fixed Expenses',
    'Cab Expense',
    'Food Apps Expense',
    'Quick Order Apps Expense',
    'Shopping Apps Expense',
    'Travel Expenses',
    'Credit card bills'
  )),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE, -- NULL means ongoing
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  last_created_date DATE, -- Track when the last automatic expense was created
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_expenses table
CREATE POLICY "Users can view their own recurring expenses"
  ON recurring_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring expenses"
  ON recurring_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring expenses"
  ON recurring_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring expenses"
  ON recurring_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_recurring_expenses_user ON recurring_expenses(user_id);
CREATE INDEX idx_recurring_expenses_active ON recurring_expenses(is_active);
CREATE INDEX idx_recurring_expenses_start_date ON recurring_expenses(start_date);
