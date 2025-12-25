import { createClient } from "@/lib/supabase/client"
import type { RecurringExpense, ExpenseCategory } from "@/lib/types"
import { expenseService } from "./expense-service"
import { monthService } from "./month-service"

interface CreateRecurringExpenseInput {
  category: ExpenseCategory
  amount: number
  description?: string | null
  frequency: "monthly" | "quarterly" | "yearly"
  start_date: string
  end_date?: string | null
  day_of_month?: number | null
}

interface UpdateRecurringExpenseInput extends Partial<CreateRecurringExpenseInput> {
  is_active?: boolean
}

export const recurringExpenseService = {
  async createRecurringExpense(input: CreateRecurringExpenseInput): Promise<RecurringExpense> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("recurring_expenses")
      .insert({
        user_id: userData.user.id,
        category: input.category,
        amount: input.amount,
        description: input.description || null,
        frequency: input.frequency,
        start_date: input.start_date,
        end_date: input.end_date || null,
        day_of_month: input.day_of_month || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getRecurringExpenses(): Promise<RecurringExpense[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateRecurringExpense(id: string, updates: UpdateRecurringExpenseInput): Promise<RecurringExpense> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("recurring_expenses")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userData.user.id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteRecurringExpense(id: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id).eq("user_id", userData.user.id)

    if (error) throw error
  },

  async processRecurringExpenses(): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data: recurringExpenses, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)

    if (error) throw error

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1

    for (const recurring of recurringExpenses || []) {
      const startDate = new Date(recurring.start_date)
      const endDate = recurring.end_date ? new Date(recurring.end_date) : null

      // Check if we should create an expense for this recurring item
      if (startDate > today) continue // Not started yet
      if (endDate && endDate < today) continue // Already ended

      const shouldCreate = this.shouldCreateExpense(recurring, today)

      if (shouldCreate) {
        try {
          // Get or create month
          const monthYear = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`
          let month = await monthService.getMonth(monthYear)
          if (!month) {
            month = await monthService.createMonth({ month_year: monthYear })
          }

          // Create the expense
          await expenseService.createExpense({
            month_id: month.id,
            category: recurring.category,
            amount: recurring.amount,
            description: recurring.description,
            expense_date: today.toISOString().split("T")[0],
          })

          // Update last_created_date
          await this.updateRecurringExpense(recurring.id, {
            last_created_date: today.toISOString().split("T")[0],
          })
        } catch (err) {
          console.error(`[v0] Error creating recurring expense: ${recurring.id}`, err)
        }
      }
    }
  },

  shouldCreateExpense(recurring: RecurringExpense, today: Date): boolean {
    const lastCreated = recurring.last_created_date ? new Date(recurring.last_created_date) : null

    switch (recurring.frequency) {
      case "monthly":
        if (!lastCreated) return true
        const nextMonth = new Date(lastCreated)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        return today >= nextMonth

      case "quarterly":
        if (!lastCreated) return true
        const nextQuarter = new Date(lastCreated)
        nextQuarter.setMonth(nextQuarter.getMonth() + 3)
        return today >= nextQuarter

      case "yearly":
        if (!lastCreated) return true
        const nextYear = new Date(lastCreated)
        nextYear.setFullYear(nextYear.getFullYear() + 1)
        return today >= nextYear

      default:
        return false
    }
  },
}
