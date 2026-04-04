"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CreditCard, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { useAllExpenses } from "@/lib/hooks/use-all-expenses"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"
import { Progress } from "@/components/ui/progress"
import type { Expense } from "@/lib/types"

export function CreditCardBillCard() {
  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  // Use unpaginated hook — we need ALL expenses for accurate totals,
  // not just the first 20 that the paginated useExpenses hook returns.
  const { data: expenses = [] } = useAllExpenses(currentMonth)

  // ── CC Budget ─────────────────────────────────────────────────────────────
  // The amount you paid FROM savings TO your credit card company this month.
  // Defined by category = "Credit card bills" — includes legacy rows that may
  // have been saved with expense_source = "credit_card" before the auto-lock.
  const ccBillExpenses = expenses.filter((exp) => exp.category === "Credit card bills")
  const ccBudget = ccBillExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  const ccBudgetCount = ccBillExpenses.length

  // ── CC Spent ──────────────────────────────────────────────────────────────
  // All expenses charged ON the credit card (expense_source = "credit_card").
  // Excludes the bill payment category — those are not card charges.
  const ccExpenses: Expense[] = expenses.filter(
    (exp) => exp.expense_source === "credit_card" && exp.category !== "Credit card bills",
  )
  const ccSpent = ccExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

  // ── Remaining ─────────────────────────────────────────────────────────────
  const remaining = ccBudget - ccSpent
  const isOverspent = remaining < 0
  const usagePercent = ccBudget > 0 ? Math.min((ccSpent / ccBudget) * 100, 100) : 0

  return (
    <Card
      className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80"
      role="region"
      aria-label="Credit Card Spending Tracker"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-500 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Credit Card</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {ccBudget === 0 ? (
          // ── Empty state ───────────────────────────────────────────────────
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/40 border border-muted/60">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Add an expense under <span className="font-medium text-foreground">Credit card bills</span> category
              (paid from Savings Account) to set your CC budget for this month.
            </p>
          </div>
        ) : (
          <>
            {/* CC Budget row */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                CC Budget (Paid to Bank)
              </p>
              <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <p className="text-2xl sm:text-3xl font-bold text-orange-600 break-words">
                  {formatAmount(ccBudget)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ccBudgetCount} payment{ccBudgetCount !== 1 ? "s" : ""} made to CC company
                </p>
              </div>
            </div>

            {/* CC Spent row */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                CC Spent This Month
              </p>
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xl sm:text-2xl font-semibold text-foreground break-words">
                  {formatAmount(ccSpent)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {ccExpenses.length} transaction{ccExpenses.length !== 1 ? "s" : ""} on credit card
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <Progress
                value={usagePercent}
                className="h-2"
                aria-label={`${usagePercent.toFixed(1)}% of CC budget used`}
              />
              <p className="text-xs text-muted-foreground text-right">
                {usagePercent.toFixed(1)}% of CC budget used
              </p>
            </div>

            {/* Remaining / Overspent */}
            <div className="pt-2 border-t">
              <div
                className={`p-4 sm:p-5 rounded-xl text-primary-foreground ${
                  isOverspent
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : "bg-gradient-to-r from-green-500 to-green-600"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-90">
                  {isOverspent ? "Over Budget" : "Remaining CC Budget"}
                </p>
                <p className="text-2xl sm:text-3xl font-bold mt-1 break-words">
                  {formatAmount(Math.abs(remaining))}
                </p>
                {isOverspent ? (
                  <div className="flex items-center gap-2 mt-3 p-3 bg-red-600/30 rounded-lg border border-red-400/50">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <p className="text-xs font-medium">
                      You&apos;ve spent more on your CC than you&apos;ve paid to the bank this month.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs opacity-80 mt-1">
                    CC spending headroom left
                  </p>
                )}
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  )
}
