"use client"

/**
 * Fetches ALL expenses for a month without pagination.
 * Use this for summary cards and aggregate calculations (totals, charts).
 *
 * For the paginated expense *list* (with load-more), use `useExpenses` instead.
 */
import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { Expense } from "@/lib/types"
import { getCustomMonthCycle } from "@/lib/utils/custom-month-cycle"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

export function useAllExpenses(currentMonth: string) {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

  const { data, isLoading, mutate } = useSWR<Expense[]>(
    userId && currentMonth ? `all-expenses-${userId}-${currentMonth}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return []

      const cycle = getCustomMonthCycle(currentMonth)

      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", userData.user.id)
        .gte("expense_date", cycle.startDate)
        .lte("expense_date", cycle.endDate)
        .order("expense_date", { ascending: false })

      return data || []
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )

  return {
    data: data ?? [],
    isLoading,
    mutate,
  }
}
