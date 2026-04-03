"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { SavingsGoal } from "@/lib/types"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

export function useSavingsGoalsData() {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

  const {
    data: goals = [],
    error,
    isLoading,
    mutate,
  } = useSWR<SavingsGoal[]>(
    userId ? `savings-goals-${userId}` : null,
    async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })

      if (error) throw error
      return data || []
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      focusThrottleInterval: 30000,
    },
  )

  return { goals, error, isLoading, mutate }
}
