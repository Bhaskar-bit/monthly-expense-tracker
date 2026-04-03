import { createClient } from "@/lib/supabase/server"
import type { RecurringExpense } from "@/lib/types"

interface MonthInfo {
  id: string
  month_year: string
}

export const recurringExpenseProcessor = {
  /**
   * Process recurring expenses for a specific month
   * @param userId - The user ID for whom to process recurring expenses
   * @param targetMonthYear - The target month in YYYY-MM format
   */
  async processRecurringForMonth(userId: string, targetMonthYear: string) {
    try {
      const supabase = await createClient()

      const { data: recurringExpenses, error: fetchError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)

      if (fetchError) throw fetchError

      const monthParts = targetMonthYear.split("-")
      const year = Number.parseInt(monthParts[0])
      const month = Number.parseInt(monthParts[1] || "1")
      const targetDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`)

      let processedCount = 0

      for (const recurring of recurringExpenses || []) {
        const shouldCreate = this.shouldCreateForMonth(recurring, targetDate)

        if (shouldCreate) {
          const alreadyExists = await this.expenseExistsInMonth(supabase, userId, targetMonthYear, recurring)
          if (!alreadyExists) {
            await this.createExpenseFromRecurring(supabase, recurring, targetDate.toISOString().split("T")[0])
            processedCount++
          }
        }
      }

      return { success: true, processed: processedCount }
    } catch (error) {
      console.error("[v0] Error processing recurring expenses:", error)
      throw error
    }
  },

  /**
   * Process recurring expenses - should only be called once per day via cron job
   * This creates expenses only on their scheduled day_of_month
   */
  async processRecurringExpensesDaily() {
    try {
      const supabase = await createClient()

      const today = new Date()
      const todayString = today.toISOString().split("T")[0] // YYYY-MM-DD
      const dayOfMonth = today.getDate()

      // Get all active recurring expenses
      const { data: recurringExpenses, error: fetchError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("is_active", true)

      if (fetchError) throw fetchError

      let processedCount = 0

      for (const recurring of recurringExpenses || []) {
        const shouldCreate = this.shouldCreateTodayOnly(recurring, dayOfMonth, todayString)

        if (shouldCreate) {
          await this.createExpenseFromRecurring(supabase, recurring, todayString)
          processedCount++
        }
      }

      return { success: true, processed: processedCount }
    } catch (error) {
      console.error("[v0] Error processing recurring expenses:", error)
      throw error
    }
  },

  async expenseExistsInMonth(
    supabase: any,
    userId: string,
    monthYear: string,
    recurring: RecurringExpense,
  ): Promise<boolean> {
    try {
      const fullMonthYear = monthYear.length === 7 ? `${monthYear}-01` : monthYear

      const { data: monthData } = await supabase
        .from("months")
        .select("id")
        .eq("user_id", userId)
        .eq("month_year", fullMonthYear)
        .single()

      if (!monthData) return false

      const { data: expenses } = await supabase
        .from("expenses")
        .select("id")
        .eq("month_id", monthData.id)
        .eq("category", recurring.category)
        .eq("amount", recurring.amount)
        .eq("description", recurring.description || "")
        .limit(1)

      return (expenses?.length || 0) > 0
    } catch (error) {
      console.error("[v0] Error checking if expense exists:", error)
      return false
    }
  },

  shouldCreateForMonth(recurring: RecurringExpense, targetDate: Date): boolean {
    // Extract year and month from targetDate and recurring start_date
    const targetYear = targetDate.getFullYear()
    const targetMonth = targetDate.getMonth() + 1 // JS months are 0-indexed

    // Parse start_date (YYYY-MM-DD format)
    const [startYear, startMonth] = recurring.start_date.split("-").map(Number)
    const [endYear, endMonth, endDay] = recurring.end_date
      ? recurring.end_date.split("-").map(Number)
      : [null, null, null]

    const targetYearMonth = `${targetYear}-${String(targetMonth).padStart(2, "0")}`
    const startYearMonth = `${startYear}-${String(startMonth).padStart(2, "0")}`
    const endYearMonth = endYear && endMonth ? `${endYear}-${String(endMonth).padStart(2, "0")}` : null

    // Check if target month is before start month
    if (targetYearMonth < startYearMonth) {
      return false
    }

    // Check if target month is after end month
    if (endYearMonth && targetYearMonth > endYearMonth) {
      return false
    }

    const frequency = recurring.frequency || "monthly"

    if (frequency === "monthly") {
      // Monthly: create in every month starting from start month
      return true
    } else if (frequency === "quarterly") {
      // Quarterly: create every 3 months
      const startDate = new Date(recurring.start_date)
      const targetDateObj = new Date(targetYear, targetMonth - 1, 1)
      const monthDiff =
        (targetDateObj.getFullYear() - startDate.getFullYear()) * 12 + (targetDateObj.getMonth() - startDate.getMonth())
      return monthDiff % 3 === 0
    } else if (frequency === "yearly") {
      // Yearly: create only in the same month of each year
      return targetMonth === startMonth
    }

    return true
  },

  /**
   * Check if a recurring expense should be created today
   * Only returns true if:
   * 1. Today is the scheduled day_of_month
   * 2. Today is within start/end date range
   * 3. Frequency matches (monthly, quarterly, yearly)
   * 4. Not already created today (last_created_date is not today)
   */
  shouldCreateTodayOnly(recurring: RecurringExpense, todayDayOfMonth: number, todayString: string): boolean {
    const startDate = new Date(recurring.start_date)
    const endDate = recurring.end_date ? new Date(recurring.end_date) : null
    const todayDate = new Date(todayString)
    const lastCreatedDate = recurring.last_created_date ? new Date(recurring.last_created_date) : null

    if (todayDate < startDate) {
      return false
    }

    if (endDate && todayDate > endDate) {
      return false
    }

    const scheduledDay = recurring.day_of_month || startDate.getDate()
    if (todayDayOfMonth !== scheduledDay) {
      return false
    }

    if (lastCreatedDate) {
      const lastCreatedString = lastCreatedDate.toISOString().split("T")[0]
      if (lastCreatedString === todayString) {
        return false
      }
    }

    if (!this.shouldCreateBasedOnFrequency(recurring, lastCreatedDate, todayDate)) {
      return false
    }

    return true
  },

  /**
   * Check if frequency allows creation
   * Monthly: create every month
   * Quarterly: create every 3 months
   * Yearly: create every year
   */
  shouldCreateBasedOnFrequency(recurring: RecurringExpense, lastCreatedDate: Date | null, todayDate: Date): boolean {
    if (!lastCreatedDate) {
      return true // First time creating
    }

    const frequency = recurring.frequency || "monthly"
    const daysSinceLastCreation = Math.floor((todayDate.getTime() - lastCreatedDate.getTime()) / (1000 * 60 * 60 * 24))

    if (frequency === "monthly") {
      // At least 25 days must pass (accounting for varying month lengths)
      return daysSinceLastCreation >= 25
    } else if (frequency === "quarterly") {
      // At least 80 days must pass (roughly 3 months)
      return daysSinceLastCreation >= 80
    } else if (frequency === "yearly") {
      // At least 350 days must pass
      return daysSinceLastCreation >= 350
    }

    return false
  },

  async createExpenseFromRecurring(supabase: any, recurring: RecurringExpense, expenseDate: string) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const [year, month] = expenseDate.split("-").slice(0, 2)
      const monthYearDate = `${year}-${month}-01`

      const { data: monthData, error: monthError } = await supabase
        .from("months")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("month_year", monthYearDate)
        .single()

      if (monthError && monthError.code !== "PGRST116") throw monthError

      let monthId = monthData?.id

      if (!monthId) {
        const { data: newMonth, error: createMonthError } = await supabase
          .from("months")
          .insert({
            user_id: userData.user.id,
            month_year: monthYearDate,
            inflow: 0,
            carryover_from_previous: 0,
          })
          .select("id")
          .single()

        if (createMonthError) throw createMonthError
        monthId = newMonth.id
      }

      const { error: expenseError } = await supabase.from("expenses").insert({
        user_id: userData.user.id,
        month_id: monthId,
        category: recurring.category,
        amount: recurring.amount,
        description: recurring.description,
        expense_date: expenseDate,
      })

      if (expenseError) throw expenseError

      const { error: updateError } = await supabase
        .from("recurring_expenses")
        .update({ last_created_date: expenseDate })
        .eq("id", recurring.id)

      if (updateError) throw updateError

    } catch (error) {
      console.error("[v0] Error creating expense from recurring:", error)
      throw error
    }
  },
}
