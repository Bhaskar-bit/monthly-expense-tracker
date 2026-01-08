'use server';

-- This script processes all recurring expenses for the current month
-- It automatically creates expenses from active recurring entries

-- First, let's check if there are any active recurring expenses
SELECT COUNT(*) as active_recurring_count 
FROM recurring_expenses 
WHERE is_active = true;

-- Get details of active recurring expenses
SELECT 
  id,
  user_id,
  category,
  amount,
  frequency,
  day_of_month,
  start_date,
  end_date,
  last_created_date,
  is_active
FROM recurring_expenses 
WHERE is_active = true
ORDER BY created_at DESC;
