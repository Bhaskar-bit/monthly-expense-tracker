-- Create months table to track monthly inflow and carryover
CREATE TABLE IF NOT EXISTS months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year DATE NOT NULL, -- First day of the month
  inflow DECIMAL(10, 2) NOT NULL DEFAULT 0,
  carryover_from_previous DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Create expenses table with categories
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_id UUID NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'Investments',
    'EMIs',
    'Monthly Fixed Expenses',
    'Cab Expense',
    'Food Apps Expense',
    'Quick Order Apps Expense',
    'Shopping Apps Expense',
    'Travel Expenses'
  )),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE months ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for months table
CREATE POLICY "Users can view their own months"
  ON months FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own months"
  ON months FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own months"
  ON months FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own months"
  ON months FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for expenses table
CREATE POLICY "Users can view their own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_months_user_month ON months(user_id, month_year);
CREATE INDEX idx_expenses_user_month ON expenses(user_id, month_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
