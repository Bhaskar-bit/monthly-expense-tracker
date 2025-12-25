-- Create category learning table for ML-based auto-categorization
CREATE TABLE IF NOT EXISTS category_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(5, 2) DEFAULT 1.0, -- 0-1 scale
  is_validated BOOLEAN DEFAULT true, -- User confirmed this categorization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create category suggestions table
CREATE TABLE IF NOT EXISTS category_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  suggested_category TEXT NOT NULL,
  confidence DECIMAL(5, 2) NOT NULL,
  is_accepted BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE category_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own training data"
  ON category_training_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert training data"
  ON category_training_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own suggestions"
  ON category_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
  ON category_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_category_training_user ON category_training_data(user_id);
CREATE INDEX idx_category_suggestions_user ON category_suggestions(user_id);
