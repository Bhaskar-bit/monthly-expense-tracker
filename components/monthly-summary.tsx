"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EXPENSE_CATEGORIES } from "@/lib/types"
import { useExpenses } from "@/lib/hooks/use-expenses"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"

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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Monthly Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Total Available</p>
          <p className="text-xl font-semibold">{formatAmount(totalAvailable)}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          <p className="text-xl font-semibold text-red-500">{formatAmount(totalExpenses)}</p>
        </div>

        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">Remaining Balance</p>
          <p className={`text-2xl font-bold ${remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
            {formatAmount(remaining)}
          </p>
        </div>

        <div className="pt-4 border-t space-y-2">
          <p className="text-sm font-medium">Expenses by Category</p>
          <div className="space-y-1 text-sm">
            {EXPENSE_CATEGORIES.map((category) => (
              <div key={category} className="flex justify-between">
                <span className="text-muted-foreground">{category}</span>
                <span className="font-medium">₹{(categoryTotals[category] || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
