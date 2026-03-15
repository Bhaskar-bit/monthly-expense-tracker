"use server"

import { createClient } from "@/lib/supabase/server"

export async function ensureMonthExistsAction(userId: string, monthYear: string) {
  try {
    const supabase = await createClient()

    // Normalize monthYear to first day of month (YYYY-MM-01 format)
    // Handle both YYYY-MM and YYYY-MM-DD formats
    const [year, month] = monthYear.split("-")
    const normalizedMonthYear = `${year}-${month}-01`

    const { data: existingMonth } = await supabase
      .from("months")
      .select("*")
      .eq("user_id", userId)
      .eq("month_year", normalizedMonthYear)
      .maybeSingle()

    if (!existingMonth) {
      const prevMonthDate = new Date(normalizedMonthYear)
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
      const prevMonthYear = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1)
        .toISOString()
        .split("T")[0]

      const { data: prevMonthData } = await supabase
        .from("months")
        .select("*")
        .eq("user_id", userId)
        .eq("month_year", prevMonthYear)
        .maybeSingle()

      let carryover = 0
      if (prevMonthData) {
        const { data: prevExpenses } = await supabase.from("expenses").select("amount").eq("month_id", prevMonthData.id)

        const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
        carryover = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous) - totalExpenses
      }

      await supabase.from("months").insert({
        user_id: userId,
        month_year: normalizedMonthYear,
        inflow: 0,
        carryover_from_previous: Math.max(0, carryover),
      })
    }

    return existingMonth || { success: true }
  } catch (error) {
    console.error("[v0] Error ensuring month exists:", error)
    throw error
  }
}
