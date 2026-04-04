"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { ExpenseCategory } from "@/lib/types"
import { getMonthForExpenseDate } from "@/lib/utils/custom-month-cycle"
import { goalContributionService } from "@/lib/services/goal-contribution-service"
import { toSafeMessage } from "@/lib/utils/safe-error"

/**
 * Writes a row to audit_logs via the service-role-backed Supabase client.
 * Fails silently — a failed audit log must never block the primary operation.
 */
async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      metadata: metadata ?? null,
    })
  } catch (err) {
    // Non-blocking: log to server console only
    console.error("[audit]", action, "failed:", err)
  }
}

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
    revalidateTag(`expenses-${correctMonthYear}`, "seconds")
    revalidateTag(`month-${finalMonthId}`, "seconds")
    revalidateTag("savings-goals", "seconds")

    // Audit trail — non-blocking
    await writeAuditLog(supabase, userData.user.id, "expense.create", "expense", expense.id, {
      category,
      amount,
      expense_date: expenseDate,
      expense_source: expenseSource,
    })

    return { success: true, expense }
  } catch (error) {
    console.error("[expense-actions] createExpense error:", error)
    // Re-throw a sanitised message so raw Supabase internals don't reach the client
    throw new Error(toSafeMessage(error))
  }
}
