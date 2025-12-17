"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useMonth } from "@/lib/context/month-context"

interface MonthSelectorProps {
  userId: string
}

export function MonthSelector({ userId }: MonthSelectorProps) {
  const { currentMonth, currentMonthDisplay, changeMonth } = useMonth()

  useEffect(() => {
    console.log("[v0] MonthSelector - currentMonth changed to:", currentMonth)
    const ensureMonthExists = async () => {
      const supabase = createClient()

      const { data: existingMonth } = await supabase
        .from("months")
        .select("*")
        .eq("user_id", userId)
        .eq("month_year", currentMonth)
        .single()

      console.log("[v0] MonthSelector - Existing month data:", existingMonth)

      if (!existingMonth) {
        console.log("[v0] MonthSelector - Month doesn't exist, creating it")
        const prevMonthDate = new Date(currentMonth)
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
        const prevMonthYear = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1)
          .toISOString()
          .split("T")[0]

        const { data: prevMonthData } = await supabase
          .from("months")
          .select("*")
          .eq("user_id", userId)
          .eq("month_year", prevMonthYear)
          .single()

        let carryover = 0
        if (prevMonthData) {
          const { data: prevExpenses } = await supabase
            .from("expenses")
            .select("amount")
            .eq("month_id", prevMonthData.id)

          const totalExpenses = prevExpenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

          carryover = Number(prevMonthData.inflow) + Number(prevMonthData.carryover_from_previous) - totalExpenses
        }

        await supabase.from("months").insert({
          user_id: userId,
          month_year: currentMonth,
          inflow: 0,
          carryover_from_previous: Math.max(0, carryover),
        })

        console.log("[v0] MonthSelector - Month created with carryover:", carryover)
      }
    }

    ensureMonthExists()
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
