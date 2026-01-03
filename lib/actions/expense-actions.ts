"use server"

import { createClient } from "@/lib/supabase/server"
import { expenseService } from "@/lib/services/expense-service"

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

    const expense = await expenseService.createExpense({
      month_id: monthId,
      category: category as any,
      amount,
      description,
      expense_date: expenseDate,
    })

    console.log("[v0] Expense created successfully:", expense.id)
    return { success: true, expense }
  } catch (error) {
    console.error("[v0] Error in createExpenseAction:", error)
    throw error
  }
}
