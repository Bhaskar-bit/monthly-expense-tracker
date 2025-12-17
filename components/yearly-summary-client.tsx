"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { useYearlyData } from "@/lib/hooks/use-yearly-data"
import { EXPENSE_CATEGORIES } from "@/lib/types"

export function YearlySummaryClient() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear.toString())

  const { data: yearlyData, isLoading } = useYearlyData(selectedYear)

  const goToPreviousYear = () => {
    setSelectedYear((prev) => (Number.parseInt(prev) - 1).toString())
  }

  const goToNextYear = () => {
    setSelectedYear((prev) => (Number.parseInt(prev) + 1).toString())
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading yearly summary...</div>
  }

  if (!yearlyData || yearlyData.months.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No data available for {selectedYear}</p>
        <p className="text-sm text-muted-foreground mt-2">Add some expenses and inflow to see your yearly summary</p>
      </div>
    )
  }

  const totalAvailable = yearlyData.totalInflow + yearlyData.totalCarryover
  const netBalance = totalAvailable - yearlyData.totalExpenses

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={goToPreviousYear}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-3xl font-bold">{selectedYear}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {yearlyData.months.length} {yearlyData.months.length === 1 ? "month" : "months"} of data
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNextYear}
              disabled={Number.parseInt(selectedYear) >= currentYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">₹{yearlyData.totalInflow.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all months</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">₹{yearlyData.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">All categories combined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year-End Balance</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
              ₹{yearlyData.finalCarryforward.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Carried to next year</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {EXPENSE_CATEGORIES.map((category) => {
              const amount = yearlyData.categoryTotals[category] || 0
              const percentage = yearlyData.totalExpenses > 0 ? (amount / yearlyData.totalExpenses) * 100 : 0

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{category}</span>
                    <span className="text-muted-foreground">
                      ₹{amount.toFixed(2)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-4 pb-2 border-b font-medium text-sm">
              <div>Month</div>
              <div className="text-right">Inflow</div>
              <div className="text-right">Expenses</div>
              <div className="text-right">Carryover</div>
              <div className="text-right">Balance</div>
            </div>
            {yearlyData.months.map((month) => {
              const [year, monthNum, day] = month.month.split("-")
              const date = new Date(Number.parseInt(year), Number.parseInt(monthNum) - 1, 1)
              const monthName = date.toLocaleDateString("en-US", { month: "short", year: "numeric" })

              return (
                <div key={month.month} className="grid grid-cols-5 gap-4 py-2 text-sm border-b">
                  <div className="font-medium">{monthName}</div>
                  <div className="text-right text-green-600">₹{month.inflow.toFixed(2)}</div>
                  <div className="text-right text-red-600">₹{month.expenses.toFixed(2)}</div>
                  <div className="text-right text-muted-foreground">₹{month.carryover.toFixed(2)}</div>
                  <div className={`text-right font-medium ${month.remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ₹{month.remaining.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
