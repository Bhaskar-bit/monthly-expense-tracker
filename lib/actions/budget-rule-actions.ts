"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"
import type { BudgetRule, RuleType, RuleOperator, RulePeriod, RuleUnit, RuleSeverity, ExpenseCategory } from "@/lib/types"

export interface CreateBudgetRuleInput {
  name: string
  rule_type: RuleType
  condition_category: ExpenseCategory | null
  condition_operator: RuleOperator
  condition_value: number
  condition_period: RulePeriod
  condition_unit: RuleUnit
  action_severity: RuleSeverity
  action_message?: string | null
}

export async function createBudgetRuleAction(input: CreateBudgetRuleInput) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("budget_rules")
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidateTag(`budget-rules-${userData.user.id}`, "seconds")
  return data as BudgetRule
}

export async function updateBudgetRuleAction(
  id: string,
  input: Partial<CreateBudgetRuleInput & { is_active: boolean }>,
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("budget_rules")
    .update(input)
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidateTag(`budget-rules-${userData.user.id}`, "seconds")
  return data as BudgetRule
}

export async function deleteBudgetRuleAction(id: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("budget_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", userData.user.id)

  if (error) throw new Error(error.message)

  revalidateTag(`budget-rules-${userData.user.id}`, "seconds")
}

export async function acknowledgeTriggerAction(triggerId: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("budget_rule_triggers")
    .update({ is_acknowledged: true })
    .eq("id", triggerId)
    .eq("user_id", userData.user.id)

  if (error) throw new Error(error.message)

  revalidateTag(`rule-triggers-${userData.user.id}`, "seconds")
}

export async function acknowledgeAllTriggersAction(monthYear: string) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("budget_rule_triggers")
    .update({ is_acknowledged: true })
    .eq("user_id", userData.user.id)
    .eq("month_year", monthYear)
    .eq("is_acknowledged", false)

  if (error) throw new Error(error.message)

  revalidateTag(`rule-triggers-${userData.user.id}`, "seconds")
}
