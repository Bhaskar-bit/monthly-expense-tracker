-- Add "Miscellaneous" and "Credit card bills" categories to expenses table constraint
-- Drop the old constraint and add a new one with all categories

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- Adding new CHECK constraint with all categories including Miscellaneous and Credit card bills
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'Investments',
  'EMIs',
  'Monthly Fixed Expenses',
  'Cab Expense',
  'Food Apps Expense',
  'Quick Order Apps Expense',
  'Shopping Apps Expense',
  'Travel Expenses',
  'Credit card bills',
  'Miscellaneous'
));
