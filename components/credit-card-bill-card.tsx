"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Check, X, AlertTriangle, CreditCard } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"

interface CreditCardBillData {
  id: string
  bill_paid_amount: number
  month_id: string
}

export function CreditCardBillCard() {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [tempBillPaid, setTempBillPaid] = useState<string>("")

  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  const { data: monthData } = useMonthData(currentMonth)
  const [creditCardData, setCreditCardData] = useState<CreditCardBillData | null>(null)
  const [expenses, setExpenses] = useState<any[]>([])

  // Fetch credit card bill and expenses
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()

        if (!userData.user || !monthData?.id) return

        // Fetch credit card bill
        const { data: billData } = await supabase
          .from("credit_card_bills")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("month_id", monthData.id)
          .maybeSingle()

        if (billData) {
          setCreditCardData(billData)
          setTempBillPaid(billData.bill_paid_amount.toString())
        } else {
          setCreditCardData(null)
          setTempBillPaid("0")
        }

        // Fetch credit card expenses
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("month_id", monthData.id)
          .eq("expense_source", "credit_card")

        setExpenses(expensesData || [])
      } catch (error) {
        console.error("[v0] Error fetching credit card data:", error)
      }
    }

    fetchData()
  }, [monthData?.id])

  const handleSave = async () => {
    if (!monthData?.id) return

    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return

    try {
      const newBillPaid = Number.parseFloat(tempBillPaid) || 0

      if (creditCardData?.id) {
        // Update existing
        const { error } = await supabase
          .from("credit_card_bills")
          .update({ bill_paid_amount: newBillPaid })
          .eq("id", creditCardData.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase.from("credit_card_bills").insert({
          user_id: userData.user.id,
          month_id: monthData.id,
          bill_paid_amount: newBillPaid,
        })

        if (error) throw error
      }

      setIsEditing(false)
      toast({
        title: "Success",
        description: "Credit card bill updated successfully",
      })

      mutate(`credit-card-bill-${currentMonth}`)
    } catch (error) {
      console.error("[v0] Error updating credit card bill:", error)
      toast({
        title: "Error",
        description: "Failed to update credit card bill",
        variant: "destructive",
      })
    }
  }

  const billPaidAmount = creditCardData?.bill_paid_amount || Number.parseFloat(tempBillPaid) || 0
  const creditCardExpensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  const remainingBill = billPaidAmount - creditCardExpensesTotal
  const isOverspent = remainingBill < 0

  return (
    <Card
      className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80"
      role="region"
      aria-label="Credit Card Bill Tracking"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-500 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Credit Card Bill</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Bill Paid Amount */}
        <div className="space-y-2">
          <Label htmlFor="bill-paid-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Bill Paid This Month
          </Label>
          {isEditing ? (
            <div className="flex gap-2 flex-col sm:flex-row">
              <Input
                id="bill-paid-input"
                type="number"
                step="0.01"
                value={tempBillPaid}
                onChange={(e) => setTempBillPaid(e.target.value)}
                placeholder="Enter amount"
                className="text-lg font-semibold h-12"
                aria-label="Enter credit card bill paid amount"
              />
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="default"
                  onClick={handleSave}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label="Save bill amount"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setTempBillPaid((creditCardData?.bill_paid_amount || 0).toString())
                  }}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label="Cancel editing"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/10">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 break-words">{formatAmount(billPaidAmount)}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditing(true)
                  setTempBillPaid(billPaidAmount.toString())
                }}
                className="h-10 w-10 flex-shrink-0"
                aria-label="Edit bill amount"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        {/* Expenses Used */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expenses Used</Label>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xl sm:text-2xl font-semibold text-muted-foreground break-words">
              {formatAmount(creditCardExpensesTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} transaction(s)</p>
          </div>
        </div>

        {/* Remaining Amount */}
        <div className="pt-4 border-t">
          <div
            className={`p-4 sm:p-5 rounded-xl text-primary-foreground ${
              isOverspent
                ? "bg-gradient-to-r from-red-500 to-red-600"
                : "bg-gradient-to-r from-green-500 to-green-600"
            }`}
          >
            <Label className="text-xs font-medium uppercase tracking-wide opacity-90">Remaining Balance</Label>
            <p className="text-2xl sm:text-3xl font-bold mt-1 break-words">{formatAmount(Math.abs(remainingBill))}</p>
            {isOverspent && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-red-600/30 rounded-lg border border-red-400/50">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium">You have exceeded your credit card bill limit this month!</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
