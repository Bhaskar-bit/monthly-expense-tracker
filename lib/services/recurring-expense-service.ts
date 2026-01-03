"use client"

import { createClient } from "@/lib/supabase/client"
import type { RecurringExpense, ExpenseCategory } from "@/lib/types"

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

// This service now only contains client-side read operations
// Create/Update/Delete operations use Server Actions instead
export const recurringExpenseService = {
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

  async deleteRecurringExpense(id: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id).eq("user_id", userData.user.id)

    if (error) throw error
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
}
