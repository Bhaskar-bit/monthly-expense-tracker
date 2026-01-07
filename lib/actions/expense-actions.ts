"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { ExpenseCategory } from "@/lib/types"

export async function createExpenseAction(
  monthId: string,
  category: string,
  amount: number,
  description: string | null,
  expenseDate: string,
) {
  try {
    console.log("[v0] createExpenseAction called with:", { monthId, category, amount, expenseDate })

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        month_id: monthId,
        user_id: userData.user.id,
        category: category as ExpenseCategory,
        amount,
        description,
        expense_date: expenseDate,
      })
      .select()
      .single()

    if (error) throw error

    console.log("[v0] Expense created successfully:", expense.id)

    // Revalidate cache tags for SWR to pick up changes
    revalidateTag(`expenses-${monthId}`)
    revalidateTag(`month-${monthId}`)

    return { success: true, expense }
  } catch (error) {
    console.error("[v0] Error in createExpenseAction:", error)
    throw error
  }
}
