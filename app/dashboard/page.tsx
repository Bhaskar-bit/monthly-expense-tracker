import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MonthSelector } from "@/components/month-selector"
import { InflowCard } from "@/components/inflow-card"
import { CreditCardBillCard } from "@/components/credit-card-bill-card"
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
import { MobileNav } from "@/components/mobile-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { ErrorBoundary } from "@/components/error-boundary"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Recurring expenses are now processed only once per day via cron job at /api/cron/process-recurring-expenses

  return (
    <PrivacyProvider>
      <MonthProvider>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 dark:to-accent/10">
          <header className="bg-card border-b sticky top-0 z-10">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate">Expense Tracker</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{data.user.email}</p>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-2 flex-wrap">
                  <ThemeToggle />
                  <PrivacyToggle />
                  <Link href="/insights" aria-label="View spending insights">
                    <Button variant="outline" size="sm">
                      <TrendingUp className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Insights</span>
                    </Button>
                  </Link>
                  <Link href="/budgets" aria-label="Manage budgets">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Budgets</span>
                    </Button>
                  </Link>
                  <Link href="/export" aria-label="Export reports">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Export</span>
                    </Button>
                  </Link>
                  <Link href="/savings-goals" aria-label="View savings goals">
                    <Button variant="outline" size="sm">
                      <Target className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Goals</span>
                    </Button>
                  </Link>
                  <Link href="/yearly-summary" aria-label="View yearly summary">
                    <Button variant="outline" size="sm">
                      <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Yearly</span>
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
                      <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                      <span className="hidden lg:inline">Logout</span>
                    </Button>
                  </form>
                </nav>

                {/* Mobile Navigation */}
                <div className="md:hidden flex items-center gap-2">
                  <ThemeToggle />
                  <MobileNav userEmail={data.user.email} />
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-6 sm:py-8">
            <div className="space-y-6 sm:space-y-8">
              <MonthSelector userId={data.user.id} />

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0">
                  <ErrorBoundary section="Income">
                    <InflowCard />
                  </ErrorBoundary>
                </div>
                <div className="min-w-0">
                  <ErrorBoundary section="Monthly Summary">
                    <MonthlySummary />
                  </ErrorBoundary>
                </div>
                <div className="min-w-0">
                  <ErrorBoundary section="Credit Card">
                    <CreditCardBillCard />
                  </ErrorBoundary>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold">Expense Timeline</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Track your daily spending</p>
                </div>
                <AddExpenseDialog>
                  <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto">
                    <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
                    Add Expense
                  </Button>
                </AddExpenseDialog>
              </div>

              <div className="pt-4">
                <ErrorBoundary section="Recurring Expenses">
                  <RecurringExpensesList />
                </ErrorBoundary>
              </div>

              <ErrorBoundary section="Expense List">
                <ExpenseList />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </MonthProvider>
    </PrivacyProvider>
  )
}
