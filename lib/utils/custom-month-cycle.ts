/**
 * Custom month cycle utilities for 24th-to-23rd expense tracking
 *
 * Example:
 * - December 2025 cycle: Nov 24, 2025 → Dec 23, 2025
 * - January 2026 cycle: Dec 24, 2025 → Jan 23, 2026
 */

export interface CustomMonthCycle {
  startDate: string // YYYY-MM-DD format
  endDate: string // YYYY-MM-DD format
  displayMonth: string // YYYY-MM format (the end month)
  displayName: string // e.g., "December 2025"
}

/**
 * Get the custom month cycle date range for a given month
 * @param monthYear - Format: YYYY-MM-DD (using the 1st as reference)
 * @returns Object with start and end dates for the custom cycle
 */
export function getCustomMonthCycle(monthYear: string): CustomMonthCycle {
  const [year, month] = monthYear.split("-").map(Number)

  // The cycle ENDS on the 23rd of the given month
  // and STARTS on the 24th of the previous month

  let startYear = year
  let startMonth = month - 1

  if (startMonth < 1) {
    startMonth = 12
    startYear -= 1
  }

  const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-24`
  const endDate = `${year}-${String(month).padStart(2, "0")}-23`

  return {
    startDate,
    endDate,
    displayMonth: `${year}-${String(month).padStart(2, "0")}`,
    displayName: new Date(year, month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
  }
}

/**
 * Determine which custom month cycle an expense date belongs to
 * @param expenseDate - Format: YYYY-MM-DD
 * @returns The month identifier (YYYY-MM-01) for the cycle this expense belongs to
 */
export function getMonthForExpenseDate(expenseDate: string): string {
  const [year, month, day] = expenseDate.split("-").map(Number)

  // If the expense is on or after the 24th, it belongs to the NEXT month's cycle
  // If the expense is before the 24th, it belongs to the CURRENT month's cycle

  if (day >= 24) {
    // Belongs to next month's cycle
    let nextMonth = month + 1
    let nextYear = year

    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }

    return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  } else {
    // Belongs to current month's cycle
    return `${year}-${String(month).padStart(2, "0")}-01`
  }
}

/**
 * Check if an expense date falls within a custom month cycle
 * @param expenseDate - Format: YYYY-MM-DD
 * @param monthYear - Format: YYYY-MM-DD
 * @returns True if the expense is in this cycle
 */
export function isExpenseInCycle(expenseDate: string, monthYear: string): boolean {
  const cycle = getCustomMonthCycle(monthYear)
  return expenseDate >= cycle.startDate && expenseDate <= cycle.endDate
}
