"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types"
import { createRecurringExpenseAction } from "@/lib/actions/recurring-expense-actions"
import { mutate } from "swr"

export function RecurringExpenseDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory | "">("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "yearly">("monthly")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [dayOfMonth, setDayOfMonth] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!category || !amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const amountValue = Number.parseFloat(amount)
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than zero",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      await createRecurringExpenseAction({
        category: category as ExpenseCategory,
        amount: amountValue,
        description: description || null,
        frequency,
        start_date: startDate,
        day_of_month: dayOfMonth ? Number.parseInt(dayOfMonth) : null,
      })

      toast({
        title: "Success",
        description: "Recurring expense created successfully",
      })

      setOpen(false)
      setCategory("")
      setAmount("")
      setDescription("")
      setFrequency("monthly")
      setStartDate(new Date().toISOString().split("T")[0])
      setDayOfMonth("")

      mutate("recurring-expenses")
    } catch (error) {
      console.error("[v0] Error creating recurring expense:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create recurring expense",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Recurring Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
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
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency *</Label>
            <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayOfMonth">Day of Month (Optional)</Label>
            <Input
              id="dayOfMonth"
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="1-31 (defaults to today)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Monthly EMI for car loan"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Creating..." : "Create Recurring Expense"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
