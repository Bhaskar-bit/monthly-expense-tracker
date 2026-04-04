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
  expense_source?: "savings_account" | "credit_card"
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

// ── Budget Rules ──────────────────────────────────────────────────────────────

export type RuleType = "threshold" | "percentage" | "velocity"
export type RuleOperator = "gt" | "gte" | "lt" | "lte"
export type RulePeriod = "daily" | "weekly" | "monthly"
export type RuleUnit = "amount" | "pct_of_inflow"
export type RuleSeverity = "info" | "warning" | "critical"

export interface BudgetRule {
  id: string
  user_id: string
  name: string
  rule_type: RuleType
  is_active: boolean
  condition_category: ExpenseCategory | null
  condition_operator: RuleOperator
  condition_value: number
  condition_period: RulePeriod
  condition_unit: RuleUnit
  action_severity: RuleSeverity
  action_message: string | null
  created_at: string
  updated_at: string
}

export interface BudgetRuleTrigger {
  id: string
  rule_id: string
  user_id: string
  month_year: string
  triggered_at: string
  trigger_data: {
    category: string | null
    current_amount: number
    threshold: number
    pct_of_inflow?: number
  } | null
  is_acknowledged: boolean
}

// ── Bank Statement Import ──────────────────────────────────────────────────────

export type ImportSourceType = "csv" | "xlsx" | "pdf" | "image"
export type ImportStatus = "pending" | "confirmed" | "cancelled"
export type ImportBank =
  | "HDFC" | "ICICI" | "SBI" | "Axis" | "Kotak"
  | "PNB" | "BankOfBaroda" | "Canara" | "IndusInd" | "YesBank"
  | "Generic"

export interface ImportSession {
  id: string
  user_id: string
  source_type: ImportSourceType
  source_bank: ImportBank | null
  status: ImportStatus
  raw_count: number | null
  confirmed_count: number | null
  created_at: string
  updated_at: string
}

export interface ImportTransaction {
  id: string
  session_id: string
  user_id: string
  raw_description: string | null
  raw_amount: number
  raw_date: string
  raw_type: "debit" | "credit" | null
  ai_category: ExpenseCategory | null
  ai_confidence: number | null
  user_category: ExpenseCategory | null
  user_description: string | null
  expense_source: "savings_account" | "credit_card"
  is_duplicate: boolean
  is_selected: boolean
  created_at: string
}

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
