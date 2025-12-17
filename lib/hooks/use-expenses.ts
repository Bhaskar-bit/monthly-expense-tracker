import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Expense } from "@/lib/types"

export function useExpenses(currentMonth: string) {
  return useSWR<Expense[]>(
    currentMonth ? `expenses-${currentMonth}` : null,
    async () => {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) return []

      const { data: monthData } = await supabase
        .from("months")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("month_year", currentMonth)
        .single()

      if (!monthData) return []

      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("month_id", monthData.id)
        .order("expense_date", { ascending: false })

      return data || []
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
}
