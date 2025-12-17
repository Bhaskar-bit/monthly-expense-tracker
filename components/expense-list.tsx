"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useExpenses } from "@/lib/hooks/use-expenses"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"

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
    return <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No expenses recorded for this month yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {expenses.map((expense) => (
        <Card key={expense.id}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{expense.category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(expense.expense_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {expense.description && <p className="text-sm text-muted-foreground">{expense.description}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-lg font-semibold">₹{Number(expense.amount).toFixed(2)}</p>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
