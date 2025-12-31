-- Add Miscellaneous category to expenses table CHECK constraint
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_category_check;

ALTER TABLE expenses
ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'Investments',
  'EMIs',
  'Monthly Fixed Expenses',
  'Cab Expense',
  'Food Apps Expense',
  'Quick Order Apps Expense',
  'Shopping Apps Expense',
  'Travel Expenses',
  'Miscellaneous'
));
