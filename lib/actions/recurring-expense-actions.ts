"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { ExpenseCategory } from "@/lib/types"

interface CreateRecurringExpenseInput {
  category: ExpenseCategory
  amount: number
  description?: string | null
  frequency: "monthly" | "quarterly" | "yearly"
  start_date: string
  end_date?: string | null
  day_of_month?: number | null
}

export async function createRecurringExpenseAction(input: CreateRecurringExpenseInput) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

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

    revalidateTag("recurring-expenses")
    return { success: true, data }
  } catch (error) {
    console.error("[v0] Error creating recurring expense:", error)
    throw error
  }
}
