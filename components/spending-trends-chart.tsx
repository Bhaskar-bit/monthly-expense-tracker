"use client"

import { useState } from "react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, BarChart2 } from "lucide-react"

interface MonthDataPoint {
  month: string        // "YYYY-MM-01"
  inflow: number
  expenses: number
  savings: number
  savingsRate: number  // 0–100
}

interface CategoryDataPoint {
  month: string
  [category: string]: string | number
}

interface SpendingTrendsChartProps {
  monthlyData: MonthDataPoint[]
  categoryData: CategoryDataPoint[]
  topCategories: string[]
}

// Compact ₹ formatter for axis ticks
function formatRupee(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value}`
}

function formatMonthLabel(monthStr: string) {
  return new Date(monthStr).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

// Distinct palette for categories
const CATEGORY_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "var(--popover)",
        color: "var(--popover-foreground)",
        border: "1px solid var(--border)",
      }}
      className="rounded-lg shadow-lg p-3 text-sm min-w-[180px]"
    >
      <p className="font-semibold mb-2" style={{ color: "var(--foreground)" }}>
        {new Date(label).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex justify-between gap-4 text-xs">
          <span style={{ color: entry.color }} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            {entry.name === "Savings Rate"
              ? `${Number(entry.value).toFixed(1)}%`
              : `₹${Number(entry.value).toLocaleString("en-IN")}`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SpendingTrendsChart({ monthlyData, categoryData, topCategories }: SpendingTrendsChartProps) {
  const [view, setView] = useState<"overview" | "categories">("overview")

  return (
    <Card className="shadow-lg border-0 mt-8">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Spending Trends
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">Last {monthlyData.length} months</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === "overview" ? "default" : "outline"}
              onClick={() => setView("overview")}
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Overview
            </Button>
            <Button
              size="sm"
              variant={view === "categories" ? "default" : "outline"}
              onClick={() => setView("categories")}
            >
              <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
              By Category
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {monthlyData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Not enough data yet — keep tracking to see your trends!
          </div>
        ) : view === "overview" ? (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                yAxisId="amount"
                tickFormatter={formatRupee}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
                width={56}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={{ stroke: "var(--border)" }}
                domain={[0, 100]}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
              <Bar yAxisId="amount" dataKey="inflow" name="Inflow" fill="#6366f1" opacity={0.85} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="amount" dataKey="expenses" name="Spent" fill="#ef4444" opacity={0.85} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="amount" dataKey="savings" name="Saved" fill="#10b981" opacity={0.85} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="savingsRate"
                name="Savings Rate"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <>
            {topCategories.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No category data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={categoryData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    tickFormatter={formatRupee}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                    width={56}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
                  {topCategories.map((cat, idx) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      name={cat}
                      stackId="a"
                      fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                      opacity={0.88}
                      radius={idx === topCategories.length - 1 ? [3, 3, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}

        {/* Summary row */}
        {monthlyData.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Avg Monthly Inflow</p>
              <p className="text-base font-bold text-primary mt-0.5">
                {formatRupee(Math.round(monthlyData.reduce((s, m) => s + m.inflow, 0) / monthlyData.length))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Avg Monthly Spent</p>
              <p className="text-base font-bold text-destructive mt-0.5">
                {formatRupee(Math.round(monthlyData.reduce((s, m) => s + m.expenses, 0) / monthlyData.length))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Avg Savings Rate</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400 mt-0.5 tabular-nums">
                {(monthlyData.reduce((s, m) => s + m.savingsRate, 0) / monthlyData.length).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
