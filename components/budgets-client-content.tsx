"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { EXPENSE_CATEGORIES } from "@/lib/types"
import { getCategoryColor } from "@/lib/utils/category-colors"

export function BudgetsClientContent({ userId }: { userId: string }) {
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedBudgets = localStorage.getItem(`budgets-${userId}`)
    if (savedBudgets) {
      setBudgets(JSON.parse(savedBudgets))
    }
    setLoading(false)
  }, [userId])

  const handleBudgetChange = (category: string, value: string) => {
    const newBudgets = {
      ...budgets,
      [category]: Number.parseFloat(value) || 0,
    }
    setBudgets(newBudgets)
    localStorage.setItem(`budgets-${userId}`, JSON.stringify(newBudgets))
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {EXPENSE_CATEGORIES.map((category) => {
        const colors = getCategoryColor(category)
        return (
          <Card key={category} className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className={`text-lg ${colors.text}`}>{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Monthly Budget Limit</label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    placeholder="Enter budget (optional)"
                    value={budgets[category] || ""}
                    onChange={(e) => handleBudgetChange(category, e.target.value)}
                    className="flex-1"
                    min="0"
                  />
                </div>
                {budgets[category] ? (
                  <p className="text-xs text-muted-foreground">Alerts enabled for ₹{budgets[category].toFixed(0)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Alerts disabled for this category</p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
