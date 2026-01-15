"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { Expense } from "@/lib/types"
import { getCustomMonthCycle } from "@/lib/utils/custom-month-cycle"

export function useExpenses(currentMonth: string) {
  return useSWR<Expense[]>(
    currentMonth ? `expenses-${currentMonth}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) return []

      const cycle = getCustomMonthCycle(currentMonth)

      console.log("[v0] useExpenses - Fetching expenses for custom cycle:", {
        month: currentMonth,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
      })

      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userData.user.id)
        .gte("expense_date", cycle.startDate)
        .lte("expense_date", cycle.endDate)
        .order("expense_date", { ascending: false })

      console.log("[v0] useExpenses - Found expenses:", data?.length || 0)

      return data || []
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
}
