"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { Month } from "@/lib/types"
import { ensureMonthExists } from "@/lib/utils/month-utils"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

export function useMonthData(currentMonth: string) {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

  return useSWR<Month | null>(
    userId && currentMonth ? `month-${userId}-${currentMonth}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return null

      try {
        return await ensureMonthExists(currentMonth)
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
