export interface Month {
  id: string
  user_id: string
  month_year: string
  inflow: number
  carryover_from_previous: number
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  user_id: string
  month_id: string
  category: ExpenseCategory
  amount: number
  description: string | null
  expense_date: string
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | "Investments"
  | "EMIs"
  | "Monthly Fixed Expenses"
  | "Cab Expense"
  | "Food Apps Expense"
  | "Quick Order Apps Expense"
  | "Shopping Apps Expense"
  | "Travel Expenses"
  | "Credit card bills" // Added Credit card bills category

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Investments",
  "EMIs",
  "Monthly Fixed Expenses",
  "Cab Expense",
  "Food Apps Expense",
  "Quick Order Apps Expense",
  "Shopping Apps Expense",
  "Travel Expenses",
  "Credit card bills", // Added Credit card bills to array
]
