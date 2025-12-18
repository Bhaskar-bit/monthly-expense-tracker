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
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { ensureMonthExists, updateNextMonthCarryover } from "@/lib/utils/month-utils"

export function AddExpenseDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory | "">("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0])
  const [isLoading, setIsLoading] = useState(false)

  const { currentMonth } = useMonth()

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

    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const monthData = await ensureMonthExists(currentMonth)

      if (!monthData) throw new Error("Failed to get or create month")

      const { error } = await supabase.from("expenses").insert({
        user_id: userData.user.id,
        month_id: monthData.id,
        category: category as ExpenseCategory,
        amount: Number.parseFloat(amount),
        description: description || null,
        expense_date: expenseDate,
      })

      if (error) throw error

      toast({
        title: "Success",
        description: "Expense added successfully",
      })

      setOpen(false)
      setCategory("")
      setAmount("")
      setDescription("")
      setExpenseDate(new Date().toISOString().split("T")[0])

      mutate(`expenses-${currentMonth}`)
      mutate(`month-${currentMonth}`)

      await updateNextMonthCarryover(currentMonth)

      // Calculate next month string for cache invalidation
      const [year, month] = currentMonth.split("-").map(Number)
      let nextMonth = month + 1
      let nextYear = year
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      const nextMonthYear = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
      mutate(`month-${nextMonthYear}`)
    } catch (error) {
      console.error("[v0] Error adding expense:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add expense",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this expense"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Adding..." : "Add Expense"}
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
