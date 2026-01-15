"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { type GoalType, GOAL_TYPES } from "@/lib/types"

interface AddGoalDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function AddGoalDialog({ children, open, onOpenChange, onSuccess }: AddGoalDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    targetAmount: "",
    monthlyAllocation: "",
    goalType: "Short-term" as GoalType,
    targetDate: "",
  })

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const targetAmountValue = Number.parseFloat(formData.targetAmount)
    if (isNaN(targetAmountValue) || targetAmountValue <= 0) {
      toast.error("Target amount must be greater than zero")
      return
    }

    const monthlyAllocationValue = formData.monthlyAllocation ? Number.parseFloat(formData.monthlyAllocation) : 0
    if (monthlyAllocationValue < 0) {
      toast.error("Monthly allocation cannot be negative")
      return
    }

    setLoading(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Not authenticated")

      const { error } = await supabase.from("savings_goals").insert({
        user_id: userData.user.id,
        name: formData.name,
        description: formData.description || null,
        target_amount: targetAmountValue,
        monthly_allocation: monthlyAllocationValue,
        goal_type: formData.goalType,
        target_date: formData.targetDate || null,
        current_amount: 0,
        status: "active",
      })

      if (error) throw error

      toast.success("Savings goal created successfully!")
      setFormData({
        name: "",
        description: "",
        targetAmount: "",
        monthlyAllocation: "",
        goalType: "Short-term",
        targetDate: "",
      })
      onOpenChange?.(false)
      onSuccess?.()
    } catch (error) {
      console.error("Error creating goal:", error)
      toast.error("Failed to create savings goal")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
          <DialogDescription>Set up a new financial goal to track your progress</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Goal Name *</Label>
            <Input
              id="name"
              placeholder="e.g., New Shoes, Emergency Fund"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional details about this goal"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="targetAmount">Target Amount *</Label>
              <Input
                id="targetAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="5000"
                value={formData.targetAmount}
                onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="monthlyAllocation">Monthly Amount</Label>
              <Input
                id="monthlyAllocation"
                type="number"
                step="0.01"
                min="0"
                placeholder="500"
                value={formData.monthlyAllocation}
                onChange={(e) => setFormData({ ...formData, monthlyAllocation: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="goalType">Goal Type *</Label>
              <Select
                value={formData.goalType}
                onValueChange={(value) => setFormData({ ...formData, goalType: value as GoalType })}
              >
                <SelectTrigger id="goalType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="targetDate">Target Date</Label>
              <Input
                id="targetDate"
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
