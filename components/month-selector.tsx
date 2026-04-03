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
    const ensureMonth = async () => {
      try {
        await ensureMonthExistsAction(userId, currentMonth)
      } catch (error) {
        console.error("[v0] MonthSelector - Error ensuring month exists:", error)
      }
    }

    ensureMonth()
  }, [currentMonth, userId])

  const handlePrevClick = () => {
    changeMonth("prev")
  }

  const handleNextClick = () => {
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
