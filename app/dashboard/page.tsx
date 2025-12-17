import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MonthSelector } from "@/components/month-selector"
import { InflowCard } from "@/components/inflow-card"
import { ExpenseList } from "@/components/expense-list"
import { MonthlySummary } from "@/components/monthly-summary"
import { AddExpenseDialog } from "@/components/add-expense-dialog"
import { Button } from "@/components/ui/button"
import { LogOut, Calendar } from "lucide-react"
import { MonthProvider } from "@/lib/context/month-context"
import Link from "next/link"
import { PrivacyToggle } from "@/components/privacy-toggle"
import { PrivacyProvider } from "@/lib/context/privacy-context"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  return (
    <PrivacyProvider>
      <MonthProvider>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Expense Tracker</h1>
                <p className="text-sm text-muted-foreground">{data.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <PrivacyToggle />
                <Link href="/yearly-summary">
                  <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Yearly Summary
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
          </header>

          <main className="container mx-auto px-4 py-8">
            <div className="space-y-6">
              <MonthSelector userId={data.user.id} />

              <div className="grid gap-6 md:grid-cols-2">
                <InflowCard />
                <MonthlySummary />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Expenses</h2>
                <AddExpenseDialog />
              </div>

              <ExpenseList />
            </div>
          </main>
        </div>
      </MonthProvider>
    </PrivacyProvider>
  )
}
