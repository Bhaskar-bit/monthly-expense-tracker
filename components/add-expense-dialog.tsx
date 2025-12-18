"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Camera, X, Loader2 } from "lucide-react"
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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const { currentMonth } = useMonth()

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size should be less than 5MB",
        variant: "destructive",
      })
      return
    }

    try {
      setIsScanning(true)
      const base64 = await fileToBase64(file)
      setUploadedImage(base64)

      // Call AI API to scan receipt
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to scan receipt")
      }

      // Auto-fill form with extracted data
      setAmount(data.amount?.toString() || "")
      setDescription(data.description || "")
      setCategory((data.category as ExpenseCategory) || "")
      if (data.date) {
        setExpenseDate(data.date)
      }

      toast({
        title: "Receipt scanned!",
        description: "Please review and confirm the extracted details",
      })
    } catch (error) {
      console.error("[v0] Image upload error:", error)
      toast({
        title: "Scan failed",
        description: error instanceof Error ? error.message : "Failed to scan receipt. Please enter manually.",
        variant: "destructive",
      })
    } finally {
      setIsScanning(false)
    }
  }

  const clearImage = () => {
    setUploadedImage(null)
  }

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
      setUploadedImage(null)

      mutate(`expenses-${currentMonth}`)
      mutate(`month-${currentMonth}`)

      await updateNextMonthCarryover(currentMonth)

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Scan Receipt (Optional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-transparent"
                disabled={isScanning}
                onClick={() => document.getElementById("receipt-upload")?.click()}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Upload Receipt
                  </>
                )}
              </Button>
              <input
                id="receipt-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isScanning}
              />
            </div>
            {uploadedImage && (
              <div className="relative mt-2 rounded-lg border p-2">
                <Button type="button" variant="ghost" size="sm" className="absolute top-1 right-1" onClick={clearImage}>
                  <X className="w-4 h-4" />
                </Button>
                <img
                  src={uploadedImage || "/placeholder.svg"}
                  alt="Receipt"
                  className="w-full h-32 object-contain rounded"
                />
                <p className="text-xs text-muted-foreground mt-1 text-center">Receipt uploaded - details extracted</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a photo of your receipt, bill, or handwritten note to auto-fill the form
            </p>
          </div>

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
            <Button type="submit" disabled={isLoading || isScanning} className="flex-1">
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
