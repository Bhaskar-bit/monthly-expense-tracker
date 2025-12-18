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

    if (prevMonthData) {
      console.log("[v0] Previous month found, calculating correct carryover...")

      // Calculate previous month's total expenses
      const { data: prevExpenses } = await supabase.from("expenses").select("amount").eq("month_id", prevMonthData.id)

      const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
      const prevTotalAvailable = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous)
      const correctCarryover = Math.max(0, prevTotalAvailable - totalExpenses)

      console.log("[v0] Carryover comparison:", {
        prevMonth: prevMonthYear,
        currentStoredCarryover: existingMonth.carryover_from_previous,
        calculatedCarryover: correctCarryover,
        prevInflow: prevMonthData.inflow,
        prevCarryover: prevMonthData.carryover_from_previous,
        prevTotalExpenses: totalExpenses,
      })

      // Update if the carryover is different
      if (existingMonth.carryover_from_previous !== correctCarryover) {
        console.log(
          "[v0] Carryover mismatch! Updating from",
          existingMonth.carryover_from_previous,
          "to",
          correctCarryover,
        )

        const { data: updatedMonth } = await supabase
          .from("months")
          .update({ carryover_from_previous: correctCarryover })
          .eq("id", existingMonth.id)
          .select("*")
          .single()

        console.log("[v0] Month carryover updated:", updatedMonth)
        return updatedMonth || existingMonth
      } else {
        console.log("[v0] Carryover is already correct, no update needed")
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

  // Update next month's carryover
  await updateNextMonthCarryover(monthYear)

  return newMonth
}

export async function updateNextMonthCarryover(currentMonthYear: string) {
  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  // Calculate next month
  const [year, month] = currentMonthYear.split("-").map(Number)
  let nextMonth = month + 1
  let nextYear = year

  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthYear = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`

  console.log("[v0] Checking if next month exists to update carryover:", nextMonthYear)

  // Check if next month exists
  const { data: nextMonthData } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", nextMonthYear)
    .single()

  if (!nextMonthData) {
    console.log("[v0] Next month doesn't exist yet, no update needed")
    return
  }

  // Get current month's data
  const { data: currentMonthData } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("month_year", currentMonthYear)
    .single()

  if (!currentMonthData) {
    console.log("[v0] Current month not found")
    return
  }

  // Calculate current month's total expenses
  const { data: currentExpenses } = await supabase.from("expenses").select("amount").eq("month_id", currentMonthData.id)

  const totalExpenses = currentExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0
  const currentTotalAvailable = Number(currentMonthData.inflow) + Number(currentMonthData.carryover_from_previous)
  const newCarryover = Math.max(0, currentTotalAvailable - totalExpenses)

  console.log("[v0] Updating next month carryover:", {
    currentMonth: currentMonthYear,
    nextMonth: nextMonthYear,
    currentInflow: currentMonthData.inflow,
    currentCarryover: currentMonthData.carryover_from_previous,
    currentTotalAvailable,
    currentTotalExpenses: totalExpenses,
    newCarryoverForNextMonth: newCarryover,
  })

  // Update next month's carryover
  const { error } = await supabase
    .from("months")
    .update({ carryover_from_previous: newCarryover })
    .eq("id", nextMonthData.id)

  if (error) {
    console.error("[v0] Error updating next month carryover:", error)
  } else {
    console.log("[v0] Next month carryover updated successfully")
  }
}
