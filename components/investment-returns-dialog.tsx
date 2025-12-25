"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TrendingUp } from "lucide-react"
import { investmentReturnsService } from "@/lib/services/investment-returns-service"
import { toast } from "sonner"

interface InvestmentReturnsDialogProps {
  goalId: string
  onSuccess?: () => void
}

export function InvestmentReturnsDialog({ goalId, onSuccess }: InvestmentReturnsDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [returnAmount, setReturnAmount] = useState("")
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0])
  const [returnSource, setReturnSource] = useState<"interest" | "dividend" | "capital_appreciation" | "manual_entry">(
    "interest",
  )
  const [notes, setNotes] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!returnAmount) {
      toast.error("Please enter return amount")
      return
    }

    setIsLoading(true)

    try {
      await investmentReturnsService.addReturn({
        goal_id: goalId,
        return_amount: Number.parseFloat(returnAmount),
        return_date: returnDate,
        return_source: returnSource,
        notes: notes || null,
      })

      toast.success("Return recorded successfully")
      setOpen(false)
      setReturnAmount("")
      setReturnDate(new Date().toISOString().split("T")[0])
      setReturnSource("interest")
      setNotes("")
      onSuccess?.()
    } catch (error) {
      console.error("Error adding return:", error)
      toast.error(error instanceof Error ? error.message : "Failed to record return")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <TrendingUp className="w-4 h-4 mr-2" />
          Add Return
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Investment Return</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="return-amount">Return Amount (₹) *</Label>
            <Input
              id="return-amount"
              type="number"
              step="0.01"
              value={returnAmount}
              onChange={(e) => setReturnAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-date">Date *</Label>
            <Input
              id="return-date"
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-source">Return Source *</Label>
            <Select value={returnSource} onValueChange={(value: any) => setReturnSource(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interest">Interest</SelectItem>
                <SelectItem value="dividend">Dividend</SelectItem>
                <SelectItem value="capital_appreciation">Capital Appreciation</SelectItem>
                <SelectItem value="manual_entry">Manual Entry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this return"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? "Recording..." : "Record Return"}
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
