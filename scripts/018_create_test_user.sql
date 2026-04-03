-- This script creates a test user with sample data for testing
-- Test user credentials: test@test.com / password123

-- Note: Users are created via Supabase Auth, so this script creates the profile data
-- The auth user should be created separately in Supabase Auth

-- Sample test data will be populated with the test user ID
-- You can find the test user ID from Supabase Auth dashboard

-- For now, we'll create a helper to create test data when the user ID is known
-- This script is a reference for creating test data

-- Example months for the test user (Q1 2024)
-- INSERT INTO months (user_id, month_year, inflow, carryover_from_previous, base_currency, created_at)
-- VALUES 
--   ('{USER_ID}', '2024-01-01', 50000, 0, 'INR', now()),
--   ('{USER_ID}', '2024-02-01', 50000, 5000, 'INR', now()),
--   ('{USER_ID}', '2024-03-01', 50000, 8000, 'INR', now());

-- Example savings goals
-- INSERT INTO savings_goals (user_id, name, description, target_amount, target_date, priority, status, created_at)
-- VALUES
--   ('{USER_ID}', 'Emergency Fund', 'Build 6 months emergency fund', 300000, '2024-12-31', 1, 'active', now()),
--   ('{USER_ID}', 'Vacation Fund', 'Trip to Europe', 200000, '2024-09-30', 2, 'active', now()),
--   ('{USER_ID}', 'Home Down Payment', 'Save for home', 1000000, '2025-12-31', 3, 'active', now());

-- Example budget limits
-- INSERT INTO budget_limits (user_id, category, monthly_limit, created_at)
-- VALUES
--   ('{USER_ID}', 'Food & Dining', 10000, now()),
--   ('{USER_ID}', 'Transportation', 5000, now()),
--   ('{USER_ID}', 'Entertainment', 3000, now()),
--   ('{USER_ID}', 'Shopping', 8000, now());

-- Test user documentation:
-- Email: test@test.com
-- Password: password123
-- This script documents the test data structure
-- Use the {USER_ID} placeholder and replace with the actual test user ID from Supabase Auth
