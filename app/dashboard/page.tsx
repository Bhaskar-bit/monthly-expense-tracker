import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MonthSelector } from "@/components/month-selector"
import { InflowCard } from "@/components/inflow-card"
import { ExpenseList } from "@/components/expense-list"
import { MonthlySummary } from "@/components/monthly-summary"
import { AddExpenseDialog } from "@/components/add-expense-dialog"
import { Button } from "@/components/ui/button"
import { LogOut, Calendar, Plus, Target, TrendingUp, Settings, Download } from "lucide-react"
import { MonthProvider } from "@/lib/context/month-context"
import Link from "next/link"
import { PrivacyToggle } from "@/components/privacy-toggle"
import { PrivacyProvider } from "@/lib/context/privacy-context"
import { RecurringExpensesList } from "@/components/recurring-expenses-list"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  return (
    <PrivacyProvider>
      <MonthProvider>
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
          <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    Expense Tracker
                  </h1>
                  <p className="text-sm text-muted-foreground">{data.user.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <PrivacyToggle />
                  <Link href="/insights">
                    <Button variant="outline" size="sm">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Insights
                    </Button>
                  </Link>
                  <Link href="/budgets">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Budgets
                    </Button>
                  </Link>
                  <Link href="/export">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </Link>
                  <Link href="/savings-goals">
                    <Button variant="outline" size="sm">
                      <Target className="w-4 h-4 mr-2" />
                      Goals
                    </Button>
                  </Link>
                  <Link href="/yearly-summary">
                    <Button variant="outline" size="sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      Yearly
                    </Button>
                  </Link>
                  <form
                    action={async () => {
                      "use server"
                      const supabase = await createClient()
                      await supabase.auth.signOut()
                      redirect("/auth/login")
                    }}
                  >
                    <Button variant="outline" size="sm" type="submit">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8">
            <div className="space-y-8">
              <MonthSelector userId={data.user.id} />

              <div className="grid gap-6 lg:grid-cols-2">
                <InflowCard />
                <MonthlySummary />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div>
                  <h2 className="text-2xl font-bold">Expense Timeline</h2>
                  <p className="text-sm text-muted-foreground mt-1">Track your daily spending</p>
                </div>
                <AddExpenseDialog>
                  <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Expense
                  </Button>
                </AddExpenseDialog>
              </div>

              <div className="pt-4">
                <RecurringExpensesList />
              </div>

              <ExpenseList />
            </div>
          </main>
        </div>
      </MonthProvider>
    </PrivacyProvider>
  )
}
