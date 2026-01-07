"use server"

import { recurringExpenseProcessor } from "@/lib/services/recurring-expense-processor"
import { createClient } from "@/lib/supabase/server"

export async function processRecurringForMonthAction(monthYear: string) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    const result = await recurringExpenseProcessor.processRecurringForMonth(userData.user.id, monthYear)
    return result
  } catch (error) {
    console.error("[v0] Error in processRecurringForMonthAction:", error)
    throw error
  }
}
