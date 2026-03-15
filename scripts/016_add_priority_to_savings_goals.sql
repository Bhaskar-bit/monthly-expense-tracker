-- Add priority column to savings_goals table
ALTER TABLE savings_goals
ADD COLUMN priority INTEGER DEFAULT 999;

-- Create index on priority for efficient ordering
CREATE INDEX idx_savings_goals_priority ON savings_goals(user_id, priority);

-- Add comments for clarity
COMMENT ON COLUMN savings_goals.priority IS 'Priority order for sequential allocation (1 = highest priority). Lower numbers are allocated first.';
