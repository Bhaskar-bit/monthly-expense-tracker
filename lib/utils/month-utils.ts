import { createClient } from "@/lib/supabase/client"

export async function ensureMonthExists(monthYear: string) {
  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  // Check if month already exists
  const { data: existingMonth } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", monthYear)
    .single()

  if (existingMonth) {
    console.log("[v0] Month already exists:", existingMonth)

    // If carryover is 0, check if we need to recalculate from previous month
    if (existingMonth.carryover_from_previous === 0) {
      console.log("[v0] Month has 0 carryover, checking if previous month has data...")

      // Calculate previous month
      const [year, month] = monthYear.split("-").map(Number)
      let prevMonth = month - 1
      let prevYear = year

      if (prevMonth < 1) {
        prevMonth = 12
        prevYear -= 1
      }

      const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

      // Get previous month's data
      const { data: prevMonthData } = await supabase
        .from("months")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("month_year", prevMonthYear)
        .single()

      if (prevMonthData && (prevMonthData.inflow > 0 || prevMonthData.carryover_from_previous > 0)) {
        console.log("[v0] Previous month has data, recalculating carryover...")

        // Calculate previous month's total expenses
        const { data: prevExpenses } = await supabase.from("expenses").select("amount").eq("month_id", prevMonthData.id)

        const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
        const prevTotalAvailable = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous)
        const carryover = Math.max(0, prevTotalAvailable - totalExpenses)

        console.log("[v0] Updating carryover:", {
          prevMonth: prevMonthYear,
          prevInflow: prevMonthData.inflow,
          prevCarryover: prevMonthData.carryover_from_previous,
          prevTotalAvailable: prevTotalAvailable,
          prevTotalExpenses: totalExpenses,
          newCarryover: carryover,
        })

        // Update the existing month with the correct carryover
        const { data: updatedMonth } = await supabase
          .from("months")
          .update({ carryover_from_previous: carryover })
          .eq("id", existingMonth.id)
          .select("*")
          .single()

        console.log("[v0] Month carryover updated:", updatedMonth)
        return updatedMonth || existingMonth
      }
    }

    return existingMonth
  }

  // Month doesn't exist, create it with carryover from previous month
  console.log("[v0] Creating new month with carryover:", monthYear)

  // Calculate previous month
  const [year, month] = monthYear.split("-").map(Number)
  let prevMonth = month - 1
  let prevYear = year

  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }

  const prevMonthYear = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`

  console.log("[v0] Looking for previous month:", prevMonthYear)

  // Get previous month's data
  const { data: prevMonthData, error: prevMonthError } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", prevMonthYear)
    .single()

  console.log("[v0] Previous month query result:", { prevMonthData, prevMonthError })

  let carryover = 0

  if (prevMonthData) {
    // Calculate previous month's total expenses
    const { data: prevExpenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount")
      .eq("month_id", prevMonthData.id)

    console.log("[v0] Previous month expenses query:", { prevExpenses, expensesError })

    const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
    const prevTotalAvailable = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous)
    carryover = prevTotalAvailable - totalExpenses

    console.log("[v0] Carryover calculation:", {
      prevMonth: prevMonthYear,
      inflow: prevMonthData.inflow,
      carryover_from_prev: prevMonthData.carryover_from_previous,
      total_available: prevTotalAvailable,
      total_expenses: totalExpenses,
      calculated_carryover: carryover,
    })
  } else {
    console.log("[v0] No previous month found, starting with 0 carryover")
  }

  const finalCarryover = Math.max(0, carryover)

  // Create new month with carryover
  const { data: newMonth, error: createError } = await supabase
    .from("months")
    .insert({
      user_id: userData.user.id,
      month_year: monthYear,
      inflow: 0,
      carryover_from_previous: finalCarryover,
    })
    .select("*")
    .single()

  if (createError) {
    console.error("[v0] Error creating month:", createError)
    throw createError
  }

  console.log("[v0] Month created successfully:", newMonth)
  return newMonth
}
