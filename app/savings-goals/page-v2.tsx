"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle2,
  Trash2,
  Trophy,
  TrendingUp,
  RefreshCw,
  Target,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { AddGoalDialogV2 } from "@/components/add-goal-dialog-v2"
import { useSavingsGoalsData } from "@/lib/hooks/use-savings-goals-data"
import {
  deleteSavingsGoalAction,
  updateGoalPriorityAction,
  completeSavingsGoalAction,
} from "@/lib/actions/goal-actions"
import { backfillHistoricalInvestmentsAction } from "@/lib/actions/backfill-actions"

interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  priority: number
  status: string
}

export default function SavingsGoalsPageV2() {
  const router = useRouter()
  const { goals: fetchedGoals, isLoading, mutate } = useSavingsGoalsData()
  const [isBackfilling, setIsBackfilling] = useState(false)

  const goals = useMemo(() => {
    if (!fetchedGoals) return []
    return [...fetchedGoals].sort((a, b) => (a.priority || 999) - (b.priority || 999))
  }, [fetchedGoals])

  async function handleDeleteGoal(goalId: string, goalName: string) {
    if (!confirm(`Delete "${goalName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteSavingsGoalAction(goalId)
      toast.success(`Goal "${goalName}" deleted`)
      await mutate()
    } catch (error) {
      console.error("[v0] Error deleting goal:", error)
      toast.error("Failed to delete goal")
    }
  }

  async function handleUpdatePriority(goalId: string, direction: "up" | "down") {
    const currentGoal = goals.find((g) => g.id === goalId)
    if (!currentGoal) return

    const currentIndex = goals.findIndex((g) => g.id === goalId)
    let newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    // Boundary checks
    if (newIndex < 0 || newIndex >= goals.length) return

    const otherGoal = goals[newIndex]
    const temp = currentGoal.priority

    try {
      // Swap priorities
      await updateGoalPriorityAction(currentGoal.id, otherGoal.priority)
      await updateGoalPriorityAction(otherGoal.id, temp)

      toast.success("Priority updated")
      await mutate()
    } catch (error) {
      console.error("[v0] Error updating priority:", error)
      toast.error("Failed to update priority")
    }
  }

  async function handleCompleteGoal(goalId: string, goalName: string) {
    try {
      await completeSavingsGoalAction(goalId)
      toast.success(`Goal "${goalName}" marked as completed!`)
      await mutate()
    } catch (error) {
      console.error("[v0] Error completing goal:", error)
      toast.error("Failed to complete goal")
    }
  }

  async function handleBackfillInvestments() {
    console.log("[v0] Backfill started. Current goals:", goals.length)
    
    if (goals.length === 0) {
      console.log("[v0] No goals available for backfill")
      toast.error("Create at least one savings goal first")
      return
    }

    try {
      setIsBackfilling(true)
      console.log("[v0] Calling backfillHistoricalInvestmentsAction...")
      const result = await backfillHistoricalInvestmentsAction()
      
      console.log("[v0] Backfill result:", result)

      if (result.success) {
        toast.success(result.message)
        console.log("[v0] Backfill successful, refreshing data...")
        await mutate()
      } else {
        console.log("[v0] Backfill failed:", result.message)
        toast.error(result.message)
      }
    } catch (error) {
      console.error("[v0] Error backfilling investments:", error)
      toast.error(error instanceof Error ? error.message : "Failed to sync historical investments")
    } finally {
      setIsBackfilling(false)
    }
  }

  const activeGoals = goals.filter((g) => g.status === "active")
  const completedGoals = goals.filter((g) => g.status === "completed")
  const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0)
  const totalAchieved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0)
  const overallProgress = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto" />
          </div>
          <p className="text-muted-foreground">Loading your savings goals...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard")}
            className="h-10 w-10"
            title="Back to Dashboard"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Savings Goals</h1>
          </div>
        </div>
        <p className="text-muted-foreground ml-13">
          Track your savings with priority-based allocation. Investment amounts are automatically distributed to your
          highest priority goals first.
        </p>
      </div>

      {/* Overall Progress Card */}
      {goals.length > 0 && (
        <Card className="mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Overall Progress
                </CardTitle>
                <CardDescription>Combined progress across all active goals</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{Math.round(overallProgress)}%</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(totalAchieved)} of {formatCurrency(totalTarget)}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(overallProgress, 100)} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <AddGoalDialogV2 onSuccess={() => mutate()}>
          <Button size="lg" className="shadow-lg">
            <Target className="w-4 h-4 mr-2" />
            Add Savings Goal
          </Button>
        </AddGoalDialogV2>

        {activeGoals.length > 0 && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleBackfillInvestments}
            disabled={isBackfilling}
            className="shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isBackfilling ? "animate-spin" : ""}`} />
            {isBackfilling ? "Syncing..." : "Sync Past Investments"}
          </Button>
        )}
      </div>

      {/* Active Goals Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-2xl font-bold">Active Goals</h2>
          <Badge variant="secondary">{activeGoals.length}</Badge>
        </div>

        {activeGoals.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">No active savings goals yet</p>
              <AddGoalDialogV2 onSuccess={() => mutate()}>
                <Button>Create Your First Goal</Button>
              </AddGoalDialogV2>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeGoals.map((goal, index) => {
              const progress = (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100
              const isTopPriority = index === 0

              return (
                <Card
                  key={goal.id}
                  className={`transition-all ${
                    isTopPriority
                      ? "border-primary/50 shadow-lg shadow-primary/10 bg-gradient-to-br from-primary/5 to-transparent"
                      : ""
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Priority Badge */}
                        <div
                          className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${
                            isTopPriority
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle>{goal.name}</CardTitle>
                            {isTopPriority && (
                              <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Next Priority</Badge>
                            )}
                          </div>
                          <CardDescription>
                            {formatCurrency(goal.current_amount || 0)} of {formatCurrency(goal.target_amount)}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdatePriority(goal.id, "up")}
                            title="Increase priority"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                        )}

                        {index < activeGoals.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdatePriority(goal.id, "down")}
                            title="Decrease priority"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompleteGoal(goal.id, goal.name)}
                          title="Mark as completed"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGoal(goal.id, goal.name)}
                          title="Delete goal"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <Progress value={Math.min(progress, 100)} className="h-3 mb-3" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{Math.round(progress)}% Complete</span>
                      <span className="font-semibold">
                        {formatCurrency(Number(goal.target_amount || 0) - Number(goal.current_amount || 0))} remaining
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Completed Goals Section */}
      {completedGoals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl font-bold">Completed Goals</h2>
            <Badge variant="outline">{completedGoals.length}</Badge>
          </div>

          <div className="space-y-3">
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div>
                        <CardTitle className="line-through">{goal.name}</CardTitle>
                        <CardDescription>Target: {formatCurrency(goal.target_amount)}</CardDescription>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteGoal(goal.id, goal.name)}
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
