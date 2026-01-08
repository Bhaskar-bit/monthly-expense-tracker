"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMonth } from "@/lib/context/month-context"
import { ensureMonthExistsAction } from "@/lib/actions/month-actions"

interface MonthSelectorProps {
  userId: string
}

export function MonthSelector({ userId }: MonthSelectorProps) {
  const { currentMonth, currentMonthDisplay, changeMonth } = useMonth()

  useEffect(() => {
    console.log("[v0] MonthSelector - currentMonth changed to:", currentMonth)

    const ensureMonth = async () => {
      try {
        await ensureMonthExistsAction(userId, currentMonth)
        console.log("[v0] MonthSelector - Month ensured for:", currentMonth)
      } catch (error) {
        console.error("[v0] MonthSelector - Error ensuring month exists:", error)
      }
    }

    ensureMonth()
  }, [currentMonth, userId])

  const handlePrevClick = () => {
    console.log("[v0] MonthSelector - Previous button clicked")
    changeMonth("prev")
  }

  const handleNextClick = () => {
    console.log("[v0] MonthSelector - Next button clicked")
    changeMonth("next")
  }

  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="icon" onClick={handlePrevClick}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <h2 className="text-xl font-semibold">{currentMonthDisplay}</h2>

      <Button variant="outline" size="icon" onClick={handleNextClick}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
