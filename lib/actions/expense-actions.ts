"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { ExpenseCategory } from "@/lib/types"
import { getMonthForExpenseDate } from "@/lib/utils/custom-month-cycle"

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

    const correctMonthYear = getMonthForExpenseDate(expenseDate)
    console.log("[v0] Expense date", expenseDate, "belongs to custom cycle:", correctMonthYear)

    // Get or create the correct month
    const { data: monthData } = await supabase
      .from("months")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("month_year", correctMonthYear)
      .maybeSingle()

    const finalMonthId = monthData?.id || monthId

    const { data: expense, error } = await supabase
      .from("expenses")
      .insert({
        month_id: finalMonthId,
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
    revalidateTag(`expenses-${correctMonthYear}`)
    revalidateTag(`month-${finalMonthId}`)

    return { success: true, expense }
  } catch (error) {
    console.error("[v0] Error in createExpenseAction:", error)
    throw error
  }
}
