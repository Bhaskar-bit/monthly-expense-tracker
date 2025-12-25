import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function InsightsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch last 12 months of data for analytics
  const { data: months } = await supabase
    .from("months")
    .select("month_year, inflow, carryover_from_previous")
    .eq("user_id", data.user.id)
    .order("month_year", { ascending: false })
    .limit(12)

  const { data: allExpenses } = await supabase
    .from("expenses")
    .select("category, amount, expense_date")
    .eq("user_id", data.user.id)
    .gte("expense_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())

  // Calculate insights
  const totalIncome = months?.reduce((sum, m) => sum + Number(m.inflow), 0) || 0
  const totalExpensesYearly = allExpenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
  const categorySpending: Record<string, number> = {}

  allExpenses?.forEach((exp) => {
    categorySpending[exp.category] = (categorySpending[exp.category] || 0) + Number(exp.amount)
  })

  const topCategories = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
                  <TrendingUp className="w-6 h-6" />
                  Spending Insights
                </h1>
                <p className="text-sm text-muted-foreground">Analyze your spending patterns</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Annual Income</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">₹{totalIncome.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Last 12 months</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Annual Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">₹{totalExpensesYearly.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {totalIncome > 0 ? ((totalExpensesYearly / totalIncome) * 100).toFixed(1) : 0}% of income
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-3xl font-bold ${totalIncome - totalExpensesYearly >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ₹{(totalIncome - totalExpensesYearly).toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {totalIncome > 0 ? (((totalIncome - totalExpensesYearly) / totalIncome) * 100).toFixed(1) : 0}% savings
                rate
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg border-0 mt-8">
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategories.map(([category, amount]) => (
                <div key={category}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{category}</span>
                    <span className="text-sm font-bold">₹{amount.toFixed(0)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(amount / (topCategories[0][1] || 1)) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalExpensesYearly > 0 ? ((amount / totalExpensesYearly) * 100).toFixed(1) : 0}% of total expenses
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 mt-8 bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/10">
          <CardHeader>
            <CardTitle className="text-primary">Smart Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Based on your spending patterns, here are some insights:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>
                  Your top spending category is <strong>{topCategories[0]?.[0] || "N/A"}</strong>. Consider setting a
                  budget limit for this category.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>
                  Your savings rate is{" "}
                  <strong>
                    {totalIncome > 0 ? (((totalIncome - totalExpensesYearly) / totalIncome) * 100).toFixed(1) : 0}%
                  </strong>
                  . Aim to increase this with recurring expense automation.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <span>
                  You have <strong>{months?.length || 0}</strong> months of financial history. Keep tracking to see more
                  detailed trends.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
