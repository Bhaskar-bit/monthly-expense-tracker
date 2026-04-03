"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { ExpenseCategory } from "@/lib/types"
import { getMonthForExpenseDate } from "@/lib/utils/custom-month-cycle"
import { goalContributionService } from "@/lib/services/goal-contribution-service"

export async function createExpenseAction(
  monthId: string,
  category: string,
  amount: number,
  description: string | null,
  expenseDate: string,
  expenseSource: "savings_account" | "credit_card" = "savings_account",
) {
  try {
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero")
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    const correctMonthYear = getMonthForExpenseDate(expenseDate)

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
        expense_source: expenseSource,
      })
      .select()
      .single()

    if (error) throw error

    // Allocate investment expenses to savings goals by priority
    if (category === "Investments") {
      await goalContributionService.allocateInvestmentByPriority(
        userData.user.id,
        expense.id,
        amount,
        expenseDate,
        supabase,
      )
    }

    // Revalidate cache tags for SWR to pick up changes
    revalidateTag(`expenses-${correctMonthYear}`)
    revalidateTag(`month-${finalMonthId}`)
    revalidateTag("savings-goals")

    return { success: true, expense }
  } catch (error) {
    console.error("[v0] Error in createExpenseAction:", error)
    throw error
  }
}
