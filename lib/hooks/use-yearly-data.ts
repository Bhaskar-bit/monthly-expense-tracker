"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import { EXPENSE_CATEGORIES } from "@/lib/types"

interface YearlySummary {
  year: number
  totalInflow: number
  totalCarryover: number
  totalExpenses: number
  categoryTotals: Record<string, number>
  finalCarryforward: number
  months: Array<{
    month: string
    inflow: number
    carryover: number
    expenses: number
    remaining: number
  }>
}

async function fetchYearlyData(year: string): Promise<YearlySummary> {
  console.log("[v0] Fetching yearly data for year:", year)

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Fetch all months for the year
  const { data: months, error: monthsError } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", user.id)
    .gte("month_year", `${year}-01-01`)
    .lte("month_year", `${year}-12-31`)
    .order("month_year", { ascending: true })

  console.log("[v0] Months fetched:", months?.length || 0, "months")
  if (monthsError) {
    console.error("[v0] Error fetching months:", monthsError)
    throw monthsError
  }

  // Fetch all expenses for the year
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .gte("expense_date", `${year}-01-01`)
    .lte("expense_date", `${year}-12-31`)

  console.log("[v0] Expenses fetched:", expenses?.length || 0, "expenses")
  if (expensesError) {
    console.error("[v0] Error fetching expenses:", expensesError)
    throw expensesError
  }

  // Calculate totals
  const totalInflow = months?.reduce((sum, m) => sum + Number(m.inflow), 0) || 0
  const totalCarryover = months?.[0] ? Number(months[0].carryover_from_previous) : 0
  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

  console.log("[v0] Totals calculated - Inflow:", totalInflow, "Expenses:", totalExpenses)

  // Calculate category totals
  const categoryTotals: Record<string, number> = {}
  EXPENSE_CATEGORIES.forEach((cat) => {
    categoryTotals[cat] = expenses?.filter((e) => e.category === cat).reduce((sum, e) => sum + Number(e.amount), 0) || 0
  })

  // Calculate monthly breakdown
  const monthlyData =
    months?.map((month) => {
      const monthExpenses =
        expenses
          ?.filter((e) => e.expense_date.startsWith(month.month_year))
          .reduce((sum, e) => sum + Number(e.amount), 0) || 0
      const totalAvailable = Number(month.inflow) + Number(month.carryover_from_previous)
      const remaining = totalAvailable - monthExpenses

      return {
        month: month.month_year,
        inflow: Number(month.inflow),
        carryover: Number(month.carryover_from_previous),
        expenses: monthExpenses,
        remaining,
      }
    }) || []

  // Calculate final carryforward (last month's remaining balance)
  const finalCarryforward = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].remaining : 0

  console.log("[v0] Yearly summary calculated:", {
    totalInflow,
    totalExpenses,
    finalCarryforward,
    monthsCount: monthlyData.length,
  })

  return {
    year: Number.parseInt(year),
    totalInflow,
    totalCarryover,
    totalExpenses,
    categoryTotals,
    finalCarryforward,
    months: monthlyData,
  }
}

export function useYearlyData(year: string) {
  return useSWR(year ? `/api/yearly-data/${year}` : null, () => fetchYearlyData(year), {
    revalidateOnFocus: false,
  })
}
