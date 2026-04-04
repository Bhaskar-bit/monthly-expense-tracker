"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { BudgetRule, BudgetRuleTrigger } from "@/lib/types"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

export function useBudgetRules() {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

  const { data, isLoading, mutate } = useSWR<BudgetRule[]>(
    userId ? `budget-rules-${userId}` : null,
    async () => {
      const { data, error } = await supabase
        .from("budget_rules")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as BudgetRule[]
    },
  )

  return { data: data ?? [], isLoading, mutate }
}

export function useRuleTriggers(monthYear: string) {
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

  const { data, isLoading, mutate } = useSWR<BudgetRuleTrigger[]>(
    userId && monthYear ? `rule-triggers-${userId}-${monthYear}` : null,
    async () => {
      const { data, error } = await supabase
        .from("budget_rule_triggers")
        .select("*, budget_rules(name, action_severity)")
        .eq("user_id", userId!)
        .eq("month_year", monthYear)
        .order("triggered_at", { ascending: false })

      if (error) throw error
      return data as BudgetRuleTrigger[]
    },
  )

  const unacknowledged = (data ?? []).filter((t) => !t.is_acknowledged)

  return { data: data ?? [], unacknowledged, isLoading, mutate }
}
