"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Pencil, Check, X, TrendingUp, ArrowDownRight, History, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { useInflowHistory } from "@/lib/hooks/use-inflow-history"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"
import { updateNextMonthCarryover } from "@/lib/utils/month-utils"
import { evaluateArithmeticExpression } from "@/lib/utils/arithmetic-evaluator"

export function InflowCard() {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [tempInflow, setTempInflow] = useState<string>("")

  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  const { data: monthData } = useMonthData(currentMonth)
  const { data: history, mutate: mutateHistory } = useInflowHistory(monthData?.id)

  const inflow = monthData ? Number(monthData.inflow) : 0
  const carryover = monthData ? Number(monthData.carryover_from_previous) : 0

  const handleSave = async () => {
    if (!monthData?.id) return

    const supabase = createClient()

    // Try to evaluate arithmetic expression, fallback to parseFloat
    const evaluatedValue = evaluateArithmeticExpression(tempInflow)
    const newInflow = evaluatedValue !== null ? evaluatedValue : (Number.parseFloat(tempInflow) || 0)

    const { error } = await supabase.from("months").update({ inflow: newInflow }).eq("id", monthData.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update inflow",
        variant: "destructive",
      })
      return
    }

    // Append to inflow history (fire-and-forget, non-blocking)
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      await supabase.from("inflow_history").insert({
        user_id: userData.user.id,
        month_id: monthData.id,
        amount: newInflow,
      })
    }

    setIsEditing(false)
    toast({
      title: "Inflow updated",
      description: `Set to ₹${newInflow.toLocaleString("en-IN")}`,
    })

    mutate(`month-${currentMonth}`)
    mutateHistory()

    await updateNextMonthCarryover(currentMonth)

    const [year, month] = currentMonth.split("-").map(Number)
    let nextMonth = month + 1
    let nextYear = year
    if (nextMonth > 12) {
      nextMonth = 1
      nextYear += 1
    }
    const nextMonthYear = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
    mutate(`month-${nextMonthYear}`)
  }

  const totalAvailable = inflow + carryover
  const hasHistory = history && history.length > 0

  return (
    <Card
      className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80"
      role="region"
      aria-label="Monthly Income"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" aria-hidden="true" />
          <span className="truncate">Monthly Income</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="inflow-input" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            This Month's Inflow
          </Label>
          {isEditing ? (
            <div className="space-y-2">
              <Input
                id="inflow-input"
                type="text"
                value={tempInflow}
                onChange={(e) => setTempInflow(e.target.value)}
                placeholder="Enter amount (e.g., 1000 + 500)"
                className="text-lg font-semibold h-12"
                aria-label="Enter inflow amount. Supports arithmetic operations like 1000 + 500"
              />
              <p className="text-xs text-muted-foreground">Tip: You can use arithmetic (e.g., 1234 + 789)</p>
            </div>
          ) : null}
          {isEditing ? (
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="default"
                  onClick={handleSave}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label="Save inflow"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setTempInflow(inflow.toString())
                  }}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label="Cancel editing"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <HoverCard openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <div
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 cursor-default group"
                  role="button"
                  tabIndex={0}
                  aria-label="Inflow amount — hover to see history"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-2xl sm:text-3xl font-bold text-primary break-words">
                      {formatAmount(inflow)}
                    </p>
                    {hasHistory && (
                      <History
                        className="w-4 h-4 text-primary/40 group-hover:text-primary/70 transition-colors flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(true)
                      setTempInflow(inflow.toString())
                    }}
                    className="h-10 w-10 flex-shrink-0"
                    aria-label="Edit inflow"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </HoverCardTrigger>

              <HoverCardContent align="start" className="w-72 p-0 overflow-hidden">
                <div className="px-4 py-3 bg-muted/50 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Inflow History
                  </p>
                </div>
                <div className="px-4 py-3">
                  {!hasHistory ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No history yet — history is recorded each time you save a new inflow value.
                    </p>
                  ) : (
                    <ol className="space-y-2">
                      {history.map((entry, idx) => {
                        const isLatest = idx === history.length - 1
                        const prev = history[idx - 1]
                        const delta = prev ? entry.amount - prev.amount : null
                        return (
                          <li key={entry.id} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {isLatest ? (
                                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-semibold ${isLatest ? "text-primary" : "text-foreground"}`}>
                                ₹{Number(entry.amount).toLocaleString("en-IN")}
                              </span>
                              {delta !== null && (
                                <span
                                  className={`text-xs flex items-center gap-0.5 ${
                                    delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
                                  }`}
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  {delta > 0 ? "+" : ""}
                                  ₹{Math.abs(delta).toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              {new Date(entry.recorded_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            Carried Forward
          </Label>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xl sm:text-2xl font-semibold text-muted-foreground break-words">
              {formatAmount(carryover)}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <Label className="text-xs font-medium uppercase tracking-wide opacity-90">Total Available</Label>
            <p className="text-2xl sm:text-3xl font-bold mt-1 break-words">{formatAmount(totalAvailable)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
