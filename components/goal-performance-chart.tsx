"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { InvestmentReturn } from "@/lib/types"
import { investmentReturnsService } from "@/lib/services/investment-returns-service"
import { formatCurrency } from "@/lib/utils"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { toast } from "sonner"

interface GoalPerformanceChartProps {
  goalId: string
  projectedReturnRate?: number
  targetAmount: number
  currentAmount: number
}

export function GoalPerformanceChart({
  goalId,
  projectedReturnRate = 0,
  targetAmount,
  currentAmount,
}: GoalPerformanceChartProps) {
  const [returns, setReturns] = useState<InvestmentReturn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReturns()
  }, [goalId])

  async function fetchReturns() {
    try {
      setLoading(true)
      const data = await investmentReturnsService.getReturnsByGoal(goalId)
      setReturns(data)
    } catch (error) {
      console.error("Error fetching returns:", error)
      toast.error("Failed to load investment returns")
    } finally {
      setLoading(false)
    }
  }

  const totalActualReturns = returns.reduce((sum, r) => sum + r.return_amount, 0)
  const projectedAnnualReturn = (currentAmount * projectedReturnRate) / 100

  const chartData = returns
    .sort((a, b) => new Date(a.return_date).getTime() - new Date(b.return_date).getTime())
    .map((r) => ({
      date: new Date(r.return_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      amount: r.return_amount,
      source: r.return_source,
    }))

  if (loading) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Return Performance</CardTitle>
          <CardDescription>Track your investment returns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-xs text-muted-foreground">Actual Returns</p>
              <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(totalActualReturns)}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <p className="text-xs text-muted-foreground">Projected Annual</p>
              <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(projectedAnnualReturn)}</p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="amount" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No returns recorded yet. Add your first return to see charts.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
