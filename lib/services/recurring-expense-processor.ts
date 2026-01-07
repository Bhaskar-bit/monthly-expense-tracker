import { createClient } from "@/lib/supabase/server"
import type { RecurringExpense } from "@/lib/types"

interface MonthInfo {
  id: string
  month_year: string
}

export const recurringExpenseProcessor = {
  async processRecurringForMonth(userId: string, targetMonthYear: string) {
    try {
      console.log(`[v0] Processing recurring expenses for ${targetMonthYear}...`)
      const supabase = await createClient()

      const { data: recurringExpenses, error: fetchError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)

      if (fetchError) throw fetchError

      const targetDate = new Date(targetMonthYear + "-01")
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

      console.log(`[v0] Processed ${processedCount} recurring expenses for ${targetMonthYear}`)
      return { success: true, processed: processedCount }
    } catch (error) {
      console.error("[v0] Error processing recurring expenses:", error)
      throw error
    }
  },

  async processRecurringExpenses() {
    try {
      console.log("[v0] Starting recurring expense processing...")
      const supabase = await createClient()

      const { data: recurringExpenses, error: fetchError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("is_active", true)

      if (fetchError) throw fetchError

      const today = new Date()
      const todayString = today.toISOString().split("T")[0]
      let processedCount = 0

      for (const recurring of recurringExpenses || []) {
        const shouldCreate = this.shouldCreateExpense(recurring, todayString)

        if (shouldCreate) {
          await this.createExpenseFromRecurring(supabase, recurring, todayString)
          processedCount++
        }
      }

      console.log(`[v0] Processed ${processedCount} recurring expenses`)
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
      const { data: monthData } = await supabase
        .from("months")
        .select("id")
        .eq("user_id", userId)
        .eq("month_year", monthYear)
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
    const startDate = new Date(recurring.start_date)
    const endDate = recurring.end_date ? new Date(recurring.end_date) : null

    // Check if target month is after start date and before end date (if exists)
    if (targetDate < startDate || (endDate && targetDate > endDate)) {
      return false
    }

    return true
  },

  shouldCreateExpense(recurring: RecurringExpense, today: string): boolean {
    const lastCreated = recurring.last_created_date ? new Date(recurring.last_created_date) : null
    const startDate = new Date(recurring.start_date)
    const todayDate = new Date(today)
    const endDate = recurring.end_date ? new Date(recurring.end_date) : null

    // Check if we're past start date and before end date (if exists)
    if (todayDate < startDate || (endDate && todayDate > endDate)) {
      return false
    }

    // Determine if today is the scheduled day
    const dayOfMonth = recurring.day_of_month || startDate.getDate()
    const todayDayOfMonth = todayDate.getDate()

    if (todayDayOfMonth !== dayOfMonth) {
      return false
    }

    if (!lastCreated) {
      return true
    }

    // Check frequency to see if enough time has passed
    switch (recurring.frequency) {
      case "monthly": {
        const monthDiff =
          (todayDate.getFullYear() - lastCreated.getFullYear()) * 12 + (todayDate.getMonth() - lastCreated.getMonth())
        return monthDiff >= 1
      }
      case "quarterly": {
        const quarterDiff =
          Math.floor((todayDate.getMonth() - lastCreated.getMonth()) / 3) +
          (todayDate.getFullYear() - lastCreated.getFullYear()) * 4
        return quarterDiff >= 1
      }
      case "yearly":
        return todayDate.getFullYear() > lastCreated.getFullYear()
      default:
        return false
    }
  },

  async createExpenseFromRecurring(supabase: any, recurring: RecurringExpense, expenseDate: string) {
    try {
      const monthYear = new Date(expenseDate).toISOString().slice(0, 7)

      const { data: monthData, error: monthError } = await supabase
        .from("months")
        .select("id")
        .eq("user_id", recurring.user_id)
        .eq("month_year", monthYear)
        .single()

      if (monthError && monthError.code !== "PGRST116") throw monthError

      let monthId = monthData?.id

      if (!monthId) {
        const { data: newMonth, error: createMonthError } = await supabase
          .from("months")
          .insert({
            user_id: recurring.user_id,
            month_year: monthYear,
            inflow: 0,
            carryover_from_previous: 0,
          })
          .select("id")
          .single()

        if (createMonthError) throw createMonthError
        monthId = newMonth.id
      }

      const { error: expenseError } = await supabase.from("expenses").insert({
        user_id: recurring.user_id,
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

      console.log(`[v0] Created expense from recurring: ${recurring.category} - ₹${recurring.amount}`)
    } catch (error) {
      console.error("[v0] Error creating expense from recurring:", error)
      throw error
    }
  },
}
