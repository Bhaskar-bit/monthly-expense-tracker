"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Trash2 } from "lucide-react"
import type { RecurringExpense } from "@/lib/types"
import { recurringExpenseService } from "@/lib/services/recurring-expense-service"
import { useToast } from "@/hooks/use-toast"
import { mutate } from "swr"
import { RecurringExpenseDialog } from "./recurring-expense-dialog"
import useSWR from "swr"

const fetchRecurringExpenses = async () => {
  try {
    const expenses = await recurringExpenseService.getRecurringExpenses()
    return expenses
  } catch (error) {
    console.error("[v0] Error fetching recurring expenses:", error)
    return []
  }
}

export function RecurringExpensesList() {
  const { data: recurringExpenses = [], isLoading, error } = useSWR("recurring-expenses", fetchRecurringExpenses)
  const { toast } = useToast()

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recurring expense?")) return

    try {
      await recurringExpenseService.deleteRecurringExpense(id)
      toast({
        title: "Success",
        description: "Recurring expense deleted",
      })
      mutate("recurring-expenses")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading recurring expenses...</div>
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive flex items-center justify-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Failed to load recurring expenses
      </div>
    )
  }

  const recurringList = recurringExpenses as RecurringExpense[]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recurring Expenses</h2>
        <RecurringExpenseDialog />
      </div>

      {recurringList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No recurring expenses set up yet</p>
            <p className="text-sm mt-1">Create one to auto-generate expenses on a schedule</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recurringList.map((expense) => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{expense.category}</h3>
                      <Badge variant="outline">{expense.frequency}</Badge>
                    </div>
                    {expense.description && <p className="text-sm text-muted-foreground mb-2">{expense.description}</p>}
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Amount: ₹{expense.amount.toFixed(2)}</p>
                      <p>Started: {new Date(expense.start_date).toLocaleDateString()}</p>
                      {expense.last_created_date && (
                        <p>Last Created: {new Date(expense.last_created_date).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(expense.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
