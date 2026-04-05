/**
 * Budget Rule Engine
 *
 * Evaluates all active budget rules for a user after each expense is created.
 * Fires alert triggers when conditions are met, deduplicating within the same period.
 *
 * Rule types:
 *  - threshold  : absolute amount (e.g. Food Apps > ₹3000 this month)
 *  - percentage : % of monthly inflow (e.g. total Spent > 80% of inflow)
 *  - velocity   : daily spending spike (e.g. Cab > ₹500 in one day)
 */

import { createClient } from "@/lib/supabase/server"
import type { BudgetRule, ExpenseCategory } from "@/lib/types"

interface EvaluateContext {
  userId: string
  monthId: string
  monthYear: string          // "YYYY-MM-DD" (first day of fiscal month)
  inflow: number
  expenseDate: string        // the expense that just triggered the evaluation
}

export interface RuleFiredResult {
  ruleId: string
  ruleName: string
  severity: "info" | "warning" | "critical"
  message: string
}

/** Called from createExpenseAction after every new expense. Returns fired rules. */
export async function evaluateBudgetRules(
  ctx: EvaluateContext,
): Promise<RuleFiredResult[]> {
  const supabase = await createClient()
  const fired: RuleFiredResult[] = []

  // 1. Load all active rules for user
  const { data: rules, error } = await supabase
    .from("budget_rules")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("is_active", true)

  if (error || !rules?.length) return fired

  for (const rule of rules as BudgetRule[]) {
    try {
      const triggered = await checkRule(supabase, rule, ctx)
      if (!triggered) continue

      // 2. Dedup: only fire once per rule per period
      const alreadyFired = await hasAlreadyFired(supabase, rule, ctx)
      if (alreadyFired) continue

      // 3. Record trigger
      const triggerData = triggered.triggerData
      await supabase.from("budget_rule_triggers").insert({
        rule_id: rule.id,
        user_id: ctx.userId,
        month_year: ctx.monthYear,
        trigger_data: triggerData,
      })

      fired.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.action_severity,
        message:
          rule.action_message ||
          buildDefaultMessage(rule, triggerData),
      })
    } catch (err) {
      // Non-blocking — rule evaluation errors must never break expense creation
      console.error("[rule-engine] error evaluating rule", rule.id, err)
    }
  }

  return fired
}

// ── Rule evaluation ────────────────────────────────────────────────────────────

async function checkRule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rule: BudgetRule,
  ctx: EvaluateContext,
): Promise<{ triggerData: BudgetRuleTrigger["trigger_data"] } | null> {
  switch (rule.rule_type) {
    case "threshold":
    case "percentage":
      return checkMonthlyRule(supabase, rule, ctx)
    case "velocity":
      return checkVelocityRule(supabase, rule, ctx)
    default:
      return null
  }
}

/** threshold + percentage — looks at the full fiscal month total */
async function checkMonthlyRule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rule: BudgetRule,
  ctx: EvaluateContext,
) {
  // Sum expenses for this month (optionally filtered by category)
  let query = supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", ctx.userId)
    .eq("month_id", ctx.monthId)
    // Only savings account expenses count toward budget rules
    .neq("expense_source", "credit_card")

  if (rule.condition_category) {
    query = query.eq("category", rule.condition_category)
  }

  const { data: expenses } = await query
  if (!expenses) return null

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  let compareValue = total
  let threshold = rule.condition_value

  if (rule.condition_unit === "pct_of_inflow") {
    // Convert to percentage of inflow for comparison
    compareValue = ctx.inflow > 0 ? (total / ctx.inflow) * 100 : 0
  }

  if (!compare(compareValue, rule.condition_operator, threshold)) return null

  return {
    triggerData: {
      category: rule.condition_category ?? null,
      current_amount: total,
      threshold: rule.condition_value,
      pct_of_inflow: ctx.inflow > 0 ? (total / ctx.inflow) * 100 : 0,
    },
  }
}

/** velocity — looks at spending for the specific expense date only */
async function checkVelocityRule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rule: BudgetRule,
  ctx: EvaluateContext,
) {
  let query = supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", ctx.userId)
    .eq("expense_date", ctx.expenseDate)
    .neq("expense_source", "credit_card")

  if (rule.condition_category) {
    query = query.eq("category", rule.condition_category)
  }

  const { data: expenses } = await query
  if (!expenses) return null

  const dayTotal = expenses.reduce((s, e) => s + Number(e.amount), 0)

  if (!compare(dayTotal, rule.condition_operator, rule.condition_value)) return null

  return {
    triggerData: {
      category: rule.condition_category ?? null,
      current_amount: dayTotal,
      threshold: rule.condition_value,
    },
  }
}

/** Returns true if this rule already fired in the current period */
async function hasAlreadyFired(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rule: BudgetRule,
  ctx: EvaluateContext,
): Promise<boolean> {
  let query = supabase
    .from("budget_rule_triggers")
    .select("id", { count: "exact", head: true })
    .eq("rule_id", rule.id)
    .eq("user_id", ctx.userId)

  if (rule.rule_type === "velocity") {
    // Velocity fires at most once per day
    query = query
      .gte("triggered_at", `${ctx.expenseDate}T00:00:00Z`)
      .lte("triggered_at", `${ctx.expenseDate}T23:59:59Z`)
  } else {
    // Threshold/percentage: once per fiscal month
    query = query.eq("month_year", ctx.monthYear)
  }

  const { count } = await query
  return (count ?? 0) > 0
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compare(a: number, op: BudgetRule["condition_operator"], b: number): boolean {
  switch (op) {
    case "gt":  return a > b
    case "gte": return a >= b
    case "lt":  return a < b
    case "lte": return a <= b
    default:    return false
  }
}

function buildDefaultMessage(
  rule: BudgetRule,
  data: BudgetRuleTrigger["trigger_data"],
): string {
  if (!data) return `Rule "${rule.name}" was triggered.`

  const cat = data.category ?? "Total spending"
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

  if (rule.condition_unit === "pct_of_inflow") {
    return `${cat} has reached ${data.pct_of_inflow?.toFixed(1)}% of your inflow (${fmt(data.current_amount)}).`
  }
  const periodLabel = rule.rule_type === "velocity" ? "today" : "this month"
  return `${cat} ${periodLabel} is ${fmt(data.current_amount)}, exceeding your ₹${rule.condition_value.toLocaleString("en-IN")} ${rule.condition_unit === "amount" ? "limit" : "threshold"}.`
}

// Re-export type so callers don't need to import from types.ts
type BudgetRuleTrigger = import("@/lib/types").BudgetRuleTrigger
