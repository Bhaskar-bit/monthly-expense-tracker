"use client"

import { useState } from "react"
import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { Expense } from "@/lib/types"
import { getCustomMonthCycle } from "@/lib/utils/custom-month-cycle"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

const PAGE_SIZE = 20

export function useExpenses(currentMonth: string) {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null
  const [page, setPage] = useState(1)

  const { data, isLoading, mutate } = useSWR<{ expenses: Expense[]; hasMore: boolean }>(
    userId && currentMonth ? `expenses-${userId}-${currentMonth}-p${page}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return { expenses: [], hasMore: false }

      const cycle = getCustomMonthCycle(currentMonth)
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, count } = await supabase
        .from("expenses")
        .select("*", { count: "exact" })
        .eq("user_id", userData.user.id)
        .gte("expense_date", cycle.startDate)
        .lte("expense_date", cycle.endDate)
        .order("expense_date", { ascending: false })
        .range(from, to)

      return {
        expenses: data || [],
        hasMore: count != null && page * PAGE_SIZE < count,
      }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  return {
    data: data?.expenses ?? [],
    hasMore: data?.hasMore ?? false,
    isLoading,
    page,
    setPage,
    mutate,
  }
}
