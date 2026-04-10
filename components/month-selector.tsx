"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMonth } from "@/lib/context/month-context"
import { ensureMonthExistsAction, processRecurringForMonthAction } from "@/lib/actions/month-actions"
import { useToast } from "@/hooks/use-toast"
import { mutate } from "swr"

interface MonthSelectorProps {
  userId: string
}

export function MonthSelector({ userId }: MonthSelectorProps) {
  const { currentMonth, currentMonthDisplay, changeMonth } = useMonth()
  const { toast } = useToast()
  // Track which months we've already processed this session to avoid re-running
  const processedMonths = useRef<Set<string>>(new Set())

  useEffect(() => {
    const ensureAndProcess = async () => {
      try {
        await ensureMonthExistsAction(userId, currentMonth)

        // Only auto-process recurring expenses once per month per session
        if (!processedMonths.current.has(currentMonth)) {
          processedMonths.current.add(currentMonth)
          const imported = await processRecurringForMonthAction(userId, currentMonth)
          if (imported > 0) {
            toast({
              title: `${imported} recurring expense${imported > 1 ? "s" : ""} imported`,
              description: `Auto-added your recurring entries for ${new Date(currentMonth).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`,
            })
            // Refresh expense list and summary cards
            mutate((key: string) => typeof key === "string" && (
              key.startsWith("expenses-") ||
              key.startsWith("all-expenses-") ||
              key.startsWith("month-")
            ), undefined, { revalidate: true })
          }
        }
      } catch (error) {
        console.error("[v0] MonthSelector - Error:", error)
      }
    }

    ensureAndProcess()
  }, [currentMonth, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="icon" onClick={() => changeMonth("prev")} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <h2 className="text-xl font-semibold">{currentMonthDisplay}</h2>

      <Button variant="outline" size="icon" onClick={() => changeMonth("next")} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
