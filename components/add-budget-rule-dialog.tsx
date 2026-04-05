"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EXPENSE_CATEGORIES, type ExpenseCategory, type RuleType, type RuleOperator, type RulePeriod, type RuleUnit, type RuleSeverity } from "@/lib/types"
import { createBudgetRuleAction, updateBudgetRuleAction, type CreateBudgetRuleInput } from "@/lib/actions/budget-rule-actions"
import type { BudgetRule } from "@/lib/types"
import { mutate } from "swr"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

interface Props {
  existingRule?: BudgetRule
  onSaved?: () => void
}

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  threshold: "Spending Threshold — alert when category exceeds an amount",
  percentage: "% of Inflow — alert when spending exceeds % of monthly income",
  velocity: "Daily Spike — alert when a single day's spending exceeds an amount",
}

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  gt:  "is greater than",
  gte: "is greater than or equal to",
  lt:  "is less than",
  lte: "is less than or equal to",
}

const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  info:     "ℹ️ Info — subtle notification",
  warning:  "⚠️ Warning — noticeable alert",
  critical: "🚨 Critical — urgent, highlighted red",
}

export function AddBudgetRuleDialog({ existingRule, onSaved }: Props) {
  const { toast } = useToast()
  const { data: user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [name, setName] = useState(existingRule?.name ?? "")
  const [ruleType, setRuleType] = useState<RuleType>(existingRule?.rule_type ?? "threshold")
  const [category, setCategory] = useState<ExpenseCategory | "all">(
    existingRule?.condition_category ?? "all"
  )
  const [operator, setOperator] = useState<RuleOperator>(existingRule?.condition_operator ?? "gt")
  const [value, setValue] = useState(existingRule?.condition_value?.toString() ?? "")
  const [period, setPeriod] = useState<RulePeriod>(existingRule?.condition_period ?? "monthly")
  const [severity, setSeverity] = useState<RuleSeverity>(existingRule?.action_severity ?? "warning")
  const [customMessage, setCustomMessage] = useState(existingRule?.action_message ?? "")

  // Derived state
  const unit: RuleUnit = ruleType === "percentage" ? "pct_of_inflow" : "amount"
  const forcedPeriod: RulePeriod = ruleType === "velocity" ? "daily" : ruleType === "threshold" ? "monthly" : "monthly"

  const valueLabel = ruleType === "percentage" ? "%" : "₹"
  const valuePlaceholder = ruleType === "percentage" ? "e.g. 80" : "e.g. 3000"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numValue = parseFloat(value)
    if (!name.trim() || isNaN(numValue) || numValue <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const input: CreateBudgetRuleInput = {
        name: name.trim(),
        rule_type: ruleType,
        condition_category: category === "all" ? null : category,
        condition_operator: operator,
        condition_value: numValue,
        condition_period: ruleType === "velocity" ? "daily" : forcedPeriod,
        condition_unit: unit,
        action_severity: severity,
        action_message: customMessage.trim() || null,
      }
      if (existingRule) {
        await updateBudgetRuleAction(existingRule.id, input)
        toast({ title: "Rule updated" })
      } else {
        await createBudgetRuleAction(input)
        toast({ title: "Rule created", description: `"${name}" is now active` })
      }
      mutate(`budget-rules-${user?.id}`)
      setOpen(false)
      onSaved?.()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save rule", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existingRule ? (
          <Button variant="outline" size="sm">Edit</Button>
        ) : (
          <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Rule</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingRule ? "Edit Rule" : "New Budget Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* Rule name */}
          <div className="space-y-1.5">
            <Label>Rule Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Food overspend alert" />
          </div>

          {/* Rule type */}
          <div className="space-y-1.5">
            <Label>Rule Type *</Label>
            <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(RULE_TYPE_LABELS) as [RuleType, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories combined</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Leave as "All categories" to track total monthly spending</p>
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <Label>Condition *</Label>
            <div className="flex gap-2 items-center">
              <Select value={operator} onValueChange={(v) => setOperator(v as RuleOperator)}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(OPERATOR_LABELS) as [RuleOperator, string][]).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-36 flex-shrink-0">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={valuePlaceholder}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{valueLabel}</span>
              </div>
            </div>
            {ruleType === "percentage" && (
              <p className="text-xs text-muted-foreground">Enter a percentage of your monthly inflow (e.g. 80 = 80%)</p>
            )}
          </div>

          {/* Alert severity */}
          <div className="space-y-1.5">
            <Label>Alert Severity *</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as RuleSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(SEVERITY_LABELS) as [RuleSeverity, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom message (optional) */}
          <div className="space-y-1.5">
            <Label>Custom Alert Message <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Leave blank to use auto-generated message"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Saving…" : existingRule ? "Update Rule" : "Create Rule"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
