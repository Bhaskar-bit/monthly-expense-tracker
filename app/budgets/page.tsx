import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BudgetsClientContent } from "@/components/budgets-client-content"
import { BudgetRulesList } from "@/components/budget-rules-list"
import { MonthProvider } from "@/lib/context/month-context"

export default async function BudgetsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

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
                  <Settings className="w-6 h-6" />
                  Budget Settings
                </h1>
                <p className="text-sm text-muted-foreground">Set spending limits for each category</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="shadow-lg border-0 mb-8 bg-gradient-to-r from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10">
          <CardHeader>
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-1 flex-shrink-0" />
              <div>
                <CardTitle className="text-amber-900 dark:text-amber-100">How Budget Alerts Work</CardTitle>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-2">
                  Set a monthly budget limit for each category. When you exceed the limit, you'll receive an alert on
                  your dashboard. Leave empty to disable alerts for a category.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <BudgetsClientContent userId={data.user.id} />

        {/* Budget Rules Engine */}
        <div className="mt-10">
          <MonthProvider>
            <BudgetRulesList />
          </MonthProvider>
        </div>

        <Card className="shadow-lg border-0 mt-8">
          <CardHeader>
            <CardTitle>Budget Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <span>Start with your average monthly spending per category as a baseline.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <span>Set realistic limits based on your income and savings goals.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <span>Review and adjust your budgets monthly based on actual spending.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">4.</span>
                <span>Consider the 50/30/20 rule: 50% needs, 30% wants, 20% savings.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
