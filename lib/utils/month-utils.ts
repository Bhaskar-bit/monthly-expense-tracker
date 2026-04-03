import { createClient } from "@/lib/supabase/client"

function normalizeMonthYear(monthYear: string): string {
  const [year, month] = monthYear.split("-").map(Number)
  return `${year}-${String(month).padStart(2, "0")}-01`
}

export async function ensureMonthExists(monthYear: string) {
  const normalizedMonthYear = normalizeMonthYear(monthYear)

  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { data: existingMonth, error: monthError } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", normalizedMonthYear)
    .maybeSingle()

  if (monthError && monthError.code !== "PGRST116") {
    console.error("[v0] Error fetching month:", monthError)
    throw monthError
  }

  if (existingMonth) {
    // Calculate previous month
    const [year, month] = normalizedMonthYear.split("-").map(Number)
    let prevMonth = month - 1
    let prevYear = year

    if (prevMonth < 1) {
      prevMonth = 12
      prevYear -= 1
    }

    const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

    const { data: prevMonthData } = await supabase
      .from("months")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("month_year", prevMonthYear)
      .maybeSingle()

    if (prevMonthData) {
      // Calculate previous month's total expenses
      const { data: prevExpenses } = await supabase.from("expenses").select("amount").eq("month_id", prevMonthData.id)

      const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
      const prevTotalAvailable = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous)
      const correctCarryover = Math.max(0, prevTotalAvailable - totalExpenses)

      // Update if the carryover is different
      if (existingMonth.carryover_from_previous !== correctCarryover) {
        const { data: updatedMonth } = await supabase
          .from("months")
          .update({ carryover_from_previous: correctCarryover })
          .eq("id", existingMonth.id)
          .select("*")
          .single()

        return updatedMonth || existingMonth
      }
    }

    return existingMonth
  }

  // Month doesn't exist, create it with carryover from previous month
  // Calculate previous month
  const [year, month] = normalizedMonthYear.split("-").map(Number)
  let prevMonth = month - 1
  let prevYear = year

  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }

  const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

  const { data: prevMonthData, error: prevMonthError } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", prevMonthYear)
    .maybeSingle()

  let carryover = 0

  if (prevMonthData) {
    // Calculate previous month's total expenses
    const { data: prevExpenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount")
      .eq("month_id", prevMonthData.id)

    const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
    const prevTotalAvailable = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous)
    carryover = prevTotalAvailable - totalExpenses
  }

  const finalCarryover = Math.max(0, carryover)

  // Use upsert to handle race conditions when ensureMonthExists is called concurrently
  // This prevents duplicate key violations when multiple requests try to create the same month
  const { data: newMonth, error: createError } = await supabase
    .from("months")
    .upsert(
      {
        user_id: userData.user.id,
        month_year: normalizedMonthYear,
        inflow: 0,
        carryover_from_previous: finalCarryover,
      },
      { onConflict: "user_id,month_year" },
    )
    .select("*")
    .single()

  if (createError) {
    console.error("[v0] Error creating month:", createError)
    throw createError
  }

  // Update next month's carryover
  await updateNextMonthCarryover(normalizedMonthYear)

  return newMonth
}

export async function updateNextMonthCarryover(currentMonthYear: string) {
  const normalizedMonthYear = normalizeMonthYear(currentMonthYear)

  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  // Calculate next month
  const [year, month] = normalizedMonthYear.split("-").map(Number)
  let nextMonth = month + 1
  let nextYear = year

  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthYear = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  const { data: nextMonthData } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", nextMonthYear)
    .maybeSingle()

  if (!nextMonthData) {
    return
  }

  const { data: currentMonthData } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", normalizedMonthYear)
    .maybeSingle()

  if (!currentMonthData) {
    return
  }

  // Calculate current month's total expenses
  const { data: currentExpenses } = await supabase.from("expenses").select("amount").eq("month_id", currentMonthData.id)

  const totalExpenses = currentExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
  const currentTotalAvailable = Number(currentMonthData.inflow) + Number(currentMonthData.carryover_from_previous)
  const newCarryover = Math.max(0, currentTotalAvailable - totalExpenses)

  // Update next month's carryover
  const { error } = await supabase
    .from("months")
    .update({ carryover_from_previous: newCarryover })
    .eq("id", nextMonthData.id)

  if (error) {
    console.error("[v0] Error updating next month carryover:", error)
  }
}
