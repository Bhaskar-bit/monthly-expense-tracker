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
  | "Credit card bills"
  | "Miscellaneous"

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Investments",
  "EMIs",
  "Monthly Fixed Expenses",
  "Cab Expense",
  "Food Apps Expense",
  "Quick Order Apps Expense",
  "Shopping Apps Expense",
  "Travel Expenses",
  "Credit card bills",
  "Miscellaneous",
]

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  description: string | null
  target_amount: number
  current_amount: number
  monthly_allocation: number
  allocation_percentage: number | null
  goal_type: GoalType
  status: GoalStatus
  target_date: string | null
  priority: number
  created_at: string
  updated_at: string
}

export type GoalType = "Short-term" | "Long-term" | "Emergency" | "Luxury"
export type GoalStatus = "active" | "completed" | "archived"

export interface GoalContribution {
  id: string
  user_id: string
  goal_id: string
  expense_id: string
  amount: number
  contribution_date: string
  created_at: string
}

export const GOAL_TYPES: GoalType[] = ["Short-term", "Long-term", "Emergency", "Luxury"]

export interface RecurringExpense {
  id: string
  user_id: string
  category: ExpenseCategory
  amount: number
  description: string | null
  frequency: "monthly" | "quarterly" | "yearly"
  start_date: string
  end_date: string | null
  day_of_month: number | null
  last_created_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RecurringFrequency = "monthly" | "quarterly" | "yearly"

export interface InvestmentReturn {
  id: string
  user_id: string
  goal_id: string
  return_amount: number
  return_date: string
  return_source: "interest" | "dividend" | "capital_appreciation" | "manual_entry"
  notes: string | null
  created_at: string
  updated_at: string
}
