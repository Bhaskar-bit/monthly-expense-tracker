"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Camera, X, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { useCurrentUser } from "@/lib/hooks/use-current-user"
import { ensureMonthExists, updateNextMonthCarryover } from "@/lib/utils/month-utils"
import { fileService } from "@/lib/services/file-service"
import { createExpenseAction } from "@/lib/actions/expense-actions"
import { evaluateArithmeticExpression } from "@/lib/utils/arithmetic-evaluator"

export function AddExpenseDialog() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory | "">("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0])
  const [expenseSource, setExpenseSource] = useState<"savings_account" | "credit_card">("savings_account")
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanFailed, setScanFailed] = useState(false)

  const { currentMonth } = useMonth()
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null

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

    const validationResult = fileService.validateImageFile(file)
    if (!validationResult.valid) {
      toast({
        title: "Error",
        description: validationResult.error,
        variant: "destructive",
      })
      return
    }

    try {
      setIsScanning(true)
      setScanFailed(false)
      let base64 = await fileToBase64(file)

      base64 = await fileService.compressImage(base64, 1200, 1200)

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
      // Keep the image visible so the user can reference it while filling in manually
      setScanFailed(true)
    } finally {
      setIsScanning(false)
    }
  }

  const clearImage = () => {
    setUploadedImage(null)
    setScanFailed(false)
  }

  const retryFromImage = () => {
    if (!uploadedImage) return
    setScanFailed(false)
    // Re-trigger scan with the already-compressed base64 image
    setIsScanning(true)
    fetch("/api/scan-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: uploadedImage }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setAmount(data.amount?.toString() || "")
        setDescription(data.description || "")
        setCategory((data.category as ExpenseCategory) || "")
        if (data.date) setExpenseDate(data.date)
        toast({ title: "Receipt scanned!", description: "Please review and confirm the extracted details" })
      })
      .catch(() => setScanFailed(true))
      .finally(() => setIsScanning(false))
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

    // Try to evaluate arithmetic expression, fallback to parseFloat
    const evaluatedValue = evaluateArithmeticExpression(amount)
    const amountValue = evaluatedValue !== null ? evaluatedValue : Number.parseFloat(amount)
    
    if (isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than zero. You can use arithmetic (e.g., 100 + 50)",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const monthData = await ensureMonthExists(currentMonth)

      if (!monthData) throw new Error("Failed to get or create month")

      await createExpenseAction(
        monthData.id,
        category as ExpenseCategory,
        amountValue,
        description || null,
        expenseDate,
        expenseSource,
      )

      toast({
        title: "Success",
        description: "Expense added successfully",
      })

      setOpen(false)
      setCategory("")
      setAmount("")
      setDescription("")
      setExpenseDate(new Date().toISOString().split("T")[0])
      setExpenseSource("savings_account")
      setUploadedImage(null)

      mutate(`expenses-${userId}-${currentMonth}`)
      mutate(`month-${userId}-${currentMonth}`)

      await updateNextMonthCarryover(currentMonth)

      const [year, month] = currentMonth.split("-").map(Number)
      let nextMonth = month + 1
      let nextYear = year
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear += 1
      }
      const nextMonthYear = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
      mutate(`month-${userId}-${nextMonthYear}`)
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
                  src={uploadedImage}
                  alt="Receipt"
                  className="w-full h-32 object-contain rounded"
                />
                {scanFailed ? (
                  <div className="mt-2 flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Scan failed — please fill in the details below
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={retryFromImage} disabled={isScanning}>
                      {isScanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                      Retry scan
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1 text-center">Receipt uploaded — details extracted</p>
                )}
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
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 500 or 1000 + 200"
              required
              aria-label="Enter expense amount. Supports arithmetic operations like 1000 + 500"
            />
            <p className="text-xs text-muted-foreground">Tip: Use arithmetic (e.g., 1000 + 500, 2000 - 300)</p>
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
            <Label htmlFor="expense-source">Payment Source *</Label>
            <Select value={expenseSource} onValueChange={(value) => setExpenseSource(value as "savings_account" | "credit_card")}>
              <SelectTrigger id="expense-source">
                <SelectValue placeholder="Select payment source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings_account">Savings Account</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {expenseSource === "credit_card" 
                ? "This will be deducted from your credit card bill paid this month" 
                : "This will be deducted from your available balance"}
            </p>
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
