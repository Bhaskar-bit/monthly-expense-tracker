-- Add expense_source column to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS expense_source text DEFAULT 'savings_account';

-- Create credit_card_bills table to track monthly credit card payments
CREATE TABLE IF NOT EXISTS credit_card_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_id uuid NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  bill_paid_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, month_id)
);

-- Enable RLS on credit_card_bills
ALTER TABLE credit_card_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_card_bills
CREATE POLICY "Users can view their own credit card bills"
  ON credit_card_bills
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit card bills"
  ON credit_card_bills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit card bills"
  ON credit_card_bills
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credit card bills"
  ON credit_card_bills
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_credit_card_bills_user_month 
  ON credit_card_bills(user_id, month_id);

CREATE INDEX IF NOT EXISTS idx_expenses_source 
  ON expenses(user_id, expense_source, month_id);
