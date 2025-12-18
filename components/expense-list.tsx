"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useExpenses } from "@/lib/hooks/use-expenses"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { getCategoryColor } from "@/lib/utils/category-colors"
import type { Expense } from "@/lib/types"

function groupExpensesByDate(expenses: Expense[]) {
  const grouped = expenses.reduce(
    (acc, expense) => {
      const date = expense.expense_date.split("T")[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(expense)
      return acc
    },
    {} as Record<string, Expense[]>,
  )

  return Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
}

export function ExpenseList() {
  const { toast } = useToast()
  const { currentMonth } = useMonth()
  const { data: expenses = [], isLoading: loading } = useExpenses(currentMonth)

  const handleDelete = async (id: string) => {
    const supabase = createClient()

    const { error } = await supabase.from("expenses").delete().eq("id", id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      })
      mutate(`expenses-${currentMonth}`)
      mutate(`month-${currentMonth}`)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-sm text-muted-foreground">Loading expenses...</p>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <div className="py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">No expenses yet</h3>
          <p className="text-sm text-muted-foreground">Add your first expense to start tracking</p>
        </div>
      </Card>
    )
  }

  const groupedExpenses = groupExpensesByDate(expenses)

  return (
    <div className="space-y-8">
      {groupedExpenses.map(([date, dateExpenses]) => {
        const dateObj = new Date(date + "T00:00:00")
        const dayTotal = dateExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

        return (
          <div key={date} className="relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center border border-primary/20">
                  <span className="text-xs font-medium text-primary">
                    {dateObj.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {dateObj.toLocaleDateString("en-US", { day: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  {dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {dateExpenses.length} {dateExpenses.length === 1 ? "expense" : "expenses"} • ₹{dayTotal.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-3 ml-16">
              {dateExpenses.map((expense) => {
                const colors = getCategoryColor(expense.category)
                return (
                  <Card
                    key={expense.id}
                    className={`group hover:shadow-md transition-all duration-200 border-l-4 ${colors.border}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                            >
                              {expense.category}
                            </span>
                          </div>
                          {expense.description && (
                            <p className="text-sm text-foreground font-medium">{expense.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xl font-bold text-foreground">₹{Number(expense.amount).toFixed(2)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(expense.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
