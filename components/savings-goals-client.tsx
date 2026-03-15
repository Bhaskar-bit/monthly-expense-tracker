"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Plus,
  Target,
  TrendingUp,
  Wallet,
  Calendar,
  MoreVertical,
  Edit2,
  Archive,
  Trash2,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { AddGoalDialog } from "@/components/add-goal-dialog"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { InvestmentReturnsDialog } from "@/components/investment-returns-dialog"
import { useSavingsGoalsData } from "@/lib/hooks/use-savings-goals-data"
import { backfillHistoricalInvestmentsAction } from "@/lib/actions/backfill-actions"
import type { GoalContribution } from "@/lib/types"

const goalTypeColors = {
  "Short-term": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Long-term": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  Emergency: "bg-red-500/10 text-red-700 dark:text-red-400",
  Luxury: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

const goalTypeIcons = {
  "Short-term": Calendar,
  "Long-term": TrendingUp,
  Emergency: Target,
  Luxury: Wallet,
}

interface SavingsGoalsClientProps {
  userId: string
}

export function SavingsGoalsClient({ userId }: SavingsGoalsClientProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [goalContributions, setGoalContributions] = useState<Record<string, GoalContribution[]>>({})
  const [isBackfilling, setIsBackfilling] = useState(false)
  const { goals, isLoading, mutate } = useSavingsGoalsData()

  async function handleBackfillInvestments() {
    try {
      setIsBackfilling(true)
      const result = await backfillHistoricalInvestmentsAction()

      if (result.success) {
        toast.success(result.message)
        // Refresh the goals data to show updated amounts
        await mutate()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("[v0] Error backfilling investments:", error)
      toast.error("Failed to sync historical investments")
    } finally {
      setIsBackfilling(false)
    }
  }

  useEffect(() => {
    if (goals.length === 0) {
      setGoalContributions({})
      return
    }

    let isMounted = true

    const fetchContributions = async () => {
      try {
        const supabase = createClient()
        const contributions: Record<string, GoalContribution[]> = {}

        for (const goal of goals) {
          if (!isMounted) return

          try {
            const { data, error } = await supabase
              .from("goal_contributions")
              .select("*")
              .eq("goal_id", goal.id)
              .order("contribution_date", { ascending: false })

            if (error) {
              console.error(`[v0] Failed to fetch contributions for goal ${goal.id}:`, error)
              continue
            }

            contributions[goal.id] = data || []
          } catch (error) {
            console.error(`[v0] Error fetching contributions for goal ${goal.id}:`, error)
          }
        }

        if (isMounted) {
          setGoalContributions(contributions)
        }
      } catch (error) {
        console.error("[v0] Error in fetchContributions:", error)
      }
    }

    fetchContributions()

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false
    }
  }, [goals.map((g) => g.id).join(",")])

  async function archiveGoal(goalId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("savings_goals").update({ status: "archived" }).eq("id", goalId)

      if (error) throw error
      toast.success("Goal archived successfully")
      mutate()
    } catch (error) {
      console.error("Error archiving goal:", error)
      toast.error("Failed to archive goal")
    }
  }

  async function deleteGoal(goalId: string) {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("savings_goals").delete().eq("id", goalId)

      if (error) throw error
      toast.success("Goal deleted successfully")
      mutate()
    } catch (error) {
      console.error("Error deleting goal:", error)
      toast.error("Failed to delete goal")
    }
  }

  const activeGoals = goals.filter((g) => g.status === "active")
  const completedGoals = goals.filter((g) => g.status === "completed")
  const archivedGoals = goals.filter((g) => g.status === "archived")

  const totalTargetAmount = activeGoals.reduce((sum, goal) => sum + goal.target_amount, 0)
  const totalCurrentAmount = activeGoals.reduce((sum, goal) => sum + goal.current_amount, 0)
  const totalMonthlyAllocation = activeGoals.reduce((sum, goal) => sum + goal.monthly_allocation, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Target</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTargetAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeGoals.length} active goals</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalCurrentAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalTargetAmount > 0 ? ((totalCurrentAmount / totalTargetAmount) * 100).toFixed(1) : 0}% of target
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Allocation</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalMonthlyAllocation)}</div>
            <p className="text-xs text-muted-foreground mt-1">Planned per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Goals */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Active Goals</h2>
            <p className="text-sm text-muted-foreground mt-1">Track your progress toward financial goals</p>
          </div>
          <div className="flex gap-2">
            {goals.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={handleBackfillInvestments}
                disabled={isBackfilling}
                className="shadow-lg hover:shadow-xl transition-shadow"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${isBackfilling ? "animate-spin" : ""}`} />
                {isBackfilling ? "Syncing..." : "Sync Past Investments"}
              </Button>
            )}
            <AddGoalDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSuccess={() => mutate()}>
              <Button size="lg" className="shadow-lg hover:shadow-xl transition-shadow">
                <Plus className="w-5 h-5 mr-2" />
                Add Goal
              </Button>
            </AddGoalDialog>
          </div>
        </div>

        {activeGoals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Goals</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Create your first savings goal to start tracking your progress
              </p>
              <AddGoalDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSuccess={() => mutate()}>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Goal
                </Button>
              </AddGoalDialog>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeGoals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100
              const remaining = goal.target_amount - goal.current_amount
              const monthsToGoal = goal.monthly_allocation > 0 ? Math.ceil(remaining / goal.monthly_allocation) : null
              const Icon = goalTypeIcons[goal.goal_type]
              const contributions = goalContributions[goal.id] || []
              const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0)

              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${goalTypeColors[goal.goal_type]}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{goal.name}</CardTitle>
                          {goal.description && <CardDescription className="mt-1">{goal.description}</CardDescription>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archiveGoal(goal.id)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteGoal(goal.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Badge variant="secondary" className="w-fit mt-2">
                      {goal.goal_type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Progress</span>
                        <span className="text-sm font-semibold">{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Saved</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(goal.current_amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="text-lg font-bold">{formatCurrency(goal.target_amount)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="text-sm font-semibold">{formatCurrency(goal.monthly_allocation)}</p>
                      </div>
                      {monthsToGoal && (
                        <div>
                          <p className="text-xs text-muted-foreground">Est. Time</p>
                          <p className="text-sm font-semibold">
                            {monthsToGoal} {monthsToGoal === 1 ? "month" : "months"}
                          </p>
                        </div>
                      )}
                    </div>

                    {totalContributions > 0 && (
                      <div className="flex items-center gap-2 pt-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Investment Contribution</p>
                          <p className="text-sm font-semibold text-green-600">{formatCurrency(totalContributions)}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 border-t">
                      <InvestmentReturnsDialog goalId={goal.id} onSuccess={() => mutate()} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4">Completed Goals</h3>
          <div className="grid gap-4 md:grid-cols-2 opacity-60">
            {completedGoals.map((goal) => {
              const Icon = goalTypeIcons[goal.goal_type]
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${goalTypeColors[goal.goal_type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          Completed
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(goal.current_amount)}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
