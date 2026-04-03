"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CreditCard } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"

export function CreditCardBillCard() {
  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  const { data: monthData } = useMonthData(currentMonth)
  const [billPaidExpenses, setBillPaidExpenses] = useState<any[]>([])
  const [creditCardExpenses, setCreditCardExpenses] = useState<any[]>([])

  // Fetch expenses for credit card bill paid and credit card usage
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()

        if (!userData.user || !monthData?.id) return

        // Fetch credit card bill paid (expenses with category "Credit card bills")
        const { data: billData } = await supabase
          .from("expenses")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("month_id", monthData.id)
          .eq("category", "Credit card bills")

        setBillPaidExpenses(billData || [])

        // Fetch credit card expenses (expenses with expense_source "credit_card")
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("*")
          .eq("user_id", userData.user.id)
          .eq("month_id", monthData.id)
          .eq("expense_source", "credit_card")

        setCreditCardExpenses(expensesData || [])
      } catch (error) {
        console.error("[v0] Error fetching credit card data:", error)
      }
    }

    fetchData()
  }, [monthData?.id])

  // Calculate bill paid from "Credit card bills" category expenses
  const billPaidAmount = billPaidExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  
  // Calculate total credit card expenses used
  const creditCardExpensesTotal = creditCardExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  
  // Calculate remaining balance
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
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Bill Paid This Month
          </Label>
          <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/10">
            <p className="text-2xl sm:text-3xl font-bold text-orange-600 break-words">{formatAmount(billPaidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{billPaidExpenses.length} payment(s)</p>
          </div>
        </div>

        {/* Expenses Used */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expenses Used</Label>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xl sm:text-2xl font-semibold text-muted-foreground break-words">
              {formatAmount(creditCardExpensesTotal)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{creditCardExpenses.length} transaction(s)</p>
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
