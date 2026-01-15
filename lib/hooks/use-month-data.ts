"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { Month } from "@/lib/types"
import { ensureMonthExists } from "@/lib/utils/month-utils"

export function useMonthData(currentMonth: string) {
  return useSWR<Month | null>(
    currentMonth ? `month-${currentMonth}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) return null

      try {
        const month = await ensureMonthExists(currentMonth)
        return month
      } catch (error) {
        console.error("[v0] Error ensuring month exists:", error)
        return null
      }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  )
}
