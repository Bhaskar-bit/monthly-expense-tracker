export const EXPENSE_CATEGORIES = [
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
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CATEGORY_COLORS: Record<ExpenseCategory, { bg: string; text: string; border: string }> = {
  Investments: { bg: "#EFF6FF", text: "#0369A1", border: "#0284C7" },
  EMIs: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  "Monthly Fixed Expenses": { bg: "#DBEAFE", text: "#0C4A6E", border: "#0369A1" },
  "Cab Expense": { bg: "#F3E8FF", text: "#581C87", border: "#A855F7" },
  "Food Apps Expense": { bg: "#FEE2E2", text: "#7F1D1D", border: "#EF4444" },
  "Quick Order Apps Expense": { bg: "#F0FDF4", text: "#166534", border: "#22C55E" },
  "Shopping Apps Expense": { bg: "#FCE7F3", text: "#831843", border: "#EC4899" },
  "Travel Expenses": { bg: "#F5F3FF", text: "#5B21B6", border: "#8B5CF6" },
  "Credit card bills": { bg: "#FECACA", text: "#7C2D12", border: "#EA580C" },
  Miscellaneous: { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF" },
}

export const EXPENSE_LIMITS = {
  MIN_AMOUNT: 0.01,
  MAX_AMOUNT: 999999999,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_IMAGE_SIZE_MB: 5,
}

export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
