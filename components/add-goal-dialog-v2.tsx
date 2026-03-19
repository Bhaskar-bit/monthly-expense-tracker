"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { createSavingsGoalAction } from "@/lib/actions/goal-actions"
import type { ReactNode } from "react"

interface AddGoalDialogV2Props {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  children?: ReactNode
}

export function AddGoalDialogV2({ open: controlledOpen, onOpenChange, onSuccess, children }: AddGoalDialogV2Props) {
  const [open, setOpen] = useState(controlledOpen ?? false)
  const [isLoading, setIsLoading] = useState(false)
  const [goalName, setGoalName] = useState("")
  const [targetAmount, setTargetAmount] = useState("")

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    console.log("[v0] Adding goal with name:", goalName, "amount:", targetAmount)

    if (!goalName.trim()) {
      toast.error("Please enter a goal name")
      return
    }

    const amount = parseFloat(targetAmount)
    if (!amount || amount <= 0) {
      toast.error("Target amount must be greater than zero")
      return
    }

    try {
      setIsLoading(true)
      console.log("[v0] Calling createSavingsGoalAction with:", { goalName, amount })
      const result = await createSavingsGoalAction(goalName, amount)
      console.log("[v0] Goal created successfully:", result)

      toast.success(`Savings goal "${goalName}" created successfully!`)
      setGoalName("")
      setTargetAmount("")
      handleOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("[v0] Error creating goal:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create savings goal")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children || <Button><Plus className="w-4 h-4 mr-2" />Add Goal</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
          <DialogDescription>
            Add a new savings goal. Goals will be allocated investments in priority order.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              placeholder="e.g., Emergency Fund, Vacation, Car Purchase"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-amount">Target Amount (₹)</Label>
            <Input
              id="target-amount"
              type="number"
              placeholder="e.g., 500000"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              disabled={isLoading}
              min="1"
              step="1000"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Savings Goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
