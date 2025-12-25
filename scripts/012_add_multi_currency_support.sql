-- Add currency support to expenses and months tables
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_in_base_currency DECIMAL(10, 2); -- Converted to user's base currency
ALTER TABLE months ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'INR';

-- Create user currency preferences
CREATE TABLE IF NOT EXISTS user_currency_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  base_currency TEXT DEFAULT 'INR',
  display_currency TEXT DEFAULT 'INR',
  auto_convert BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exchange rate cache
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- Enable Row Level Security
ALTER TABLE user_currency_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences"
  ON user_currency_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_currency_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_exchange_rates_pair ON exchange_rates(from_currency, to_currency);
