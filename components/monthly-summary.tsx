"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EXPENSE_CATEGORIES } from "@/lib/types"
import { useExpenses } from "@/lib/hooks/use-expenses"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"
import { Progress } from "@/components/ui/progress"
import { getCategoryColor } from "@/lib/utils/category-colors"

export function MonthlySummary() {
  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  const { data: monthData } = useMonthData(currentMonth)
  const { data: expenses = [] } = useExpenses(currentMonth)

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

  const categoryTotals: Record<string, number> = {}
  EXPENSE_CATEGORIES.forEach((cat) => {
    categoryTotals[cat] = expenses
      .filter((exp) => exp.category === cat)
      .reduce((sum, exp) => sum + Number(exp.amount), 0)
  })

  const totalAvailable = monthData ? Number(monthData.inflow) + Number(monthData.carryover_from_previous) : 0
  const remaining = totalAvailable - totalExpenses

  return (
    <Card
      className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80"
      role="region"
      aria-label="Monthly Overview"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl">Monthly Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1 p-3 sm:p-4 rounded-lg bg-primary/5 border border-primary/10 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">Available</p>
            <p className="text-lg sm:text-2xl font-bold text-primary break-words">{formatAmount(totalAvailable)}</p>
          </div>
          <div className="space-y-1 p-3 sm:p-4 rounded-lg bg-destructive/5 border border-destructive/10 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">Spent</p>
            <p className="text-lg sm:text-2xl font-bold text-destructive break-words">{formatAmount(totalExpenses)}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <p className="text-sm font-medium text-muted-foreground mb-2">Remaining Balance</p>
          <p
            className={`text-2xl sm:text-3xl font-bold break-words ${remaining >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}
          >
            {formatAmount(remaining)}
          </p>
          {totalAvailable > 0 && (
            <div className="mt-3">
              <Progress
                value={(remaining / totalAvailable) * 100}
                className="h-2"
                aria-label={`${((remaining / totalAvailable) * 100).toFixed(1)}% remaining`}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {((remaining / totalAvailable) * 100).toFixed(1)}% remaining
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t space-y-3">
          <h3 className="text-sm font-semibold">Expenses by Category</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {EXPENSE_CATEGORIES.map((category) => {
              const amount = categoryTotals[category] || 0
              const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
              const colors = getCategoryColor(category)

              if (amount === 0) return null

              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm gap-2">
                    <span className={`font-medium truncate ${colors.text}`}>{category}</span>
                    <span className="font-semibold flex-shrink-0">₹{amount.toFixed(2)}</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors.bg} border-r-2 ${colors.border} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(percentage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${category}: ${percentage.toFixed(1)}%`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total</p>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
