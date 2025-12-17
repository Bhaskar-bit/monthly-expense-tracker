import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { ArrowRight, TrendingDown, Calculator, PiggyBank } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">Monthly Expense Tracker</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Track your monthly income, manage expenses across categories, and watch your savings grow month after
              month.
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/login">Login</Link>
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3 pt-8">
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <PiggyBank className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Track Inflow</h3>
                <p className="text-sm text-muted-foreground">
                  Set your monthly income and track carryover from previous months
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <TrendingDown className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Categorize Expenses</h3>
                <p className="text-sm text-muted-foreground">
                  Organize expenses across 8 categories for better insights
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Calculator className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Monthly Summary</h3>
                <p className="text-sm text-muted-foreground">
                  Get automatic calculations and see remaining balance at month end
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="pt-8 space-y-4">
            <h2 className="text-2xl font-semibold">Expense Categories</h2>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Investments",
                "EMIs",
                "Monthly Fixed Expenses",
                "Cab Expense",
                "Food Apps Expense",
                "Quick Order Apps Expense",
                "Shopping Apps Expense",
                "Travel Expenses",
                "Credit card bills", // Added Credit card bills category
              ].map((category) => (
                <div key={category} className="px-4 py-2 rounded-full bg-muted text-sm font-medium">
                  {category}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
