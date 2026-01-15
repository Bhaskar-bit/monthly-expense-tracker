"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { SavingsGoal } from "@/lib/types"

const fetcher = async (key: string) => {
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export function useSavingsGoalsData() {
  const {
    data: goals = [],
    error,
    isLoading,
    mutate,
  } = useSWR<SavingsGoal[]>("savings-goals", fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    focusThrottleInterval: 30000,
  })

  return { goals, error, isLoading, mutate }
}
