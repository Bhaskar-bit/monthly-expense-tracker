"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings } from "lucide-react"
import { EXPENSE_CATEGORIES } from "@/lib/types"
import { budgetService } from "@/lib/services/budget-service"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent } from "@/components/ui/card"

export function BudgetSettingsDialog() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>("")
  const [limit, setLimit] = useState("")
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchBudgets()
    }
  }, [open])

  const fetchBudgets = async () => {
    try {
      setLoading(true)
      const data = await budgetService.getBudgetLimits()
      setBudgets(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch budgets",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!category || !limit) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    const limitValue = Number.parseFloat(limit)
    if (isNaN(limitValue) || limitValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Budget limit must be greater than zero",
        variant: "destructive",
      })
      return
    }

    try {
      await budgetService.setBudgetLimit(category as any, limitValue)
      toast({
        title: "Success",
        description: `Budget set for ${category}`,
      })
      setCategory("")
      setLimit("")
      fetchBudgets()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set budget",
        variant: "destructive",
      })
    }
  }

  const handleDeleteBudget = async (cat: string) => {
    try {
      await budgetService.deleteBudgetLimit(cat as any)
      toast({
        title: "Success",
        description: "Budget deleted",
      })
      fetchBudgets()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete budget",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Budget Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Monthly Budget Limits</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSetBudget} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="limit">Monthly Limit (₹)</Label>
            <Input
              id="limit"
              type="number"
              step="0.01"
              min="0.01"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <Button type="submit" className="w-full">
            Set Budget
          </Button>
        </form>

        <div className="space-y-3 mt-6">
          <h3 className="font-semibold">Current Budgets</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budgets set</p>
          ) : (
            budgets.map((budget) => (
              <Card key={budget.id}>
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="font-medium">{budget.category}</p>
                    <p className="text-sm text-muted-foreground">₹{budget.monthly_limit}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBudget(budget.category)}
                    className="text-destructive"
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
