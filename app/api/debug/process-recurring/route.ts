import { createClient } from "@/lib/supabase/server"
import { recurringExpenseProcessor } from "@/lib/services/recurring-expense-processor"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const currentDate = new Date()
    const currentMonthYear = currentDate.toISOString().slice(0, 7)

    // Get all recurring expenses for debugging
    const { data: recurringExpenses, error: fetchError } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("user_id", userData.user.id)

    const activeExpenses = recurringExpenses?.filter((r: any) => r.is_active) || []

    const result = await recurringExpenseProcessor.processRecurringForMonth(userData.user.id, currentMonthYear)

    return NextResponse.json({
      success: true,
      currentMonthYear,
      totalRecurringCount: recurringExpenses?.length || 0,
      activeRecurringCount: activeExpenses.length,
      processedCount: result.processed,
      details: activeExpenses,
    })
  } catch (error) {
    console.error("[v0] DEBUG: Error processing recurring expenses:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
