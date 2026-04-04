"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Zap, Trash2, Bell, BellOff, CheckCheck } from "lucide-react"
import { useBudgetRules, useRuleTriggers } from "@/lib/hooks/use-budget-rules"
import { updateBudgetRuleAction, deleteBudgetRuleAction, acknowledgeAllTriggersAction } from "@/lib/actions/budget-rule-actions"
import { AddBudgetRuleDialog } from "@/components/add-budget-rule-dialog"
import { useToast } from "@/hooks/use-toast"
import { useMonth } from "@/lib/context/month-context"
import { useCurrentUser } from "@/lib/hooks/use-current-user"
import { mutate } from "swr"
import type { BudgetRule, RuleSeverity } from "@/lib/types"

const SEVERITY_BADGE: Record<RuleSeverity, { label: string; className: string }> = {
  info:     { label: "Info",     className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  warning:  { label: "Warning",  className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
}

function ruleDescription(rule: BudgetRule): string {
  const cat = rule.condition_category ?? "All spending"
  const op = rule.condition_operator === "gt" || rule.condition_operator === "gte" ? "exceeds" : "falls below"
  const val = rule.condition_unit === "pct_of_inflow"
    ? `${rule.condition_value}% of inflow`
    : `₹${rule.condition_value.toLocaleString("en-IN")}`
  const period = rule.rule_type === "velocity" ? "in a single day" : "this month"
  return `${cat} ${op} ${val} ${period}`
}

export function BudgetRulesList() {
  const { toast } = useToast()
  const { data: user } = useCurrentUser()
  const { currentMonth } = useMonth()
  const { data: rules, isLoading, mutate: mutateRules } = useBudgetRules()
  const { unacknowledged, mutate: mutateTriggers } = useRuleTriggers(currentMonth)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleToggle(rule: BudgetRule) {
    try {
      await updateBudgetRuleAction(rule.id, { is_active: !rule.is_active })
      mutate(`budget-rules-${user?.id}`)
    } catch {
      toast({ title: "Error", description: "Could not update rule", variant: "destructive" })
    }
  }

  async function handleDelete(rule: BudgetRule) {
    setDeleting(rule.id)
    try {
      await deleteBudgetRuleAction(rule.id)
      mutate(`budget-rules-${user?.id}`)
      toast({ title: "Rule deleted", description: `"${rule.name}" removed` })
    } catch {
      toast({ title: "Error", description: "Could not delete rule", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  async function handleAcknowledgeAll() {
    try {
      await acknowledgeAllTriggersAction(currentMonth)
      mutate(`rule-triggers-${user?.id}-${currentMonth}`)
      toast({ title: "All alerts cleared" })
    } catch {
      toast({ title: "Error", description: "Could not clear alerts", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">

      {/* Unacknowledged alerts banner */}
      {unacknowledged.length > 0 && (
        <Card className="border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4" />
                  {unacknowledged.length} budget alert{unacknowledged.length > 1 ? "s" : ""} this month
                </p>
                <ul className="space-y-1">
                  {unacknowledged.map((t) => (
                    <li key={t.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                      • {(t as any).budget_rules?.name ?? "Rule"} — triggered {new Date(t.triggered_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </li>
                  ))}
                </ul>
              </div>
              <Button size="sm" variant="outline" onClick={handleAcknowledgeAll} className="flex-shrink-0 text-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" />Clear all
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Budget Rules
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rules fire automatically when you add an expense
          </p>
        </div>
        <AddBudgetRuleDialog onSaved={() => mutate(`budget-rules-${user?.id}`)} />
      </div>

      {/* Rules */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading rules…</div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <BellOff className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No rules yet</p>
            <p className="text-xs text-muted-foreground">Add your first rule to get automatic spending alerts</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const severity = SEVERITY_BADGE[rule.action_severity]
            return (
              <Card key={rule.id} className={`border transition-opacity ${!rule.is_active ? "opacity-50" : ""}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggle(rule)}
                      aria-label={`${rule.is_active ? "Disable" : "Enable"} rule ${rule.name}`}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge className={`text-xs ${severity.className}`}>{severity.label}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{rule.rule_type}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{ruleDescription(rule)}</p>
                      {rule.action_message && (
                        <p className="text-xs text-muted-foreground/80 mt-0.5 italic">"{rule.action_message}"</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <AddBudgetRuleDialog existingRule={rule} onSaved={() => mutate(`budget-rules-${user?.id}`)} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule)}
                        disabled={deleting === rule.id}
                        aria-label={`Delete rule ${rule.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
