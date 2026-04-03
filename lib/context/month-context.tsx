"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface MonthContextType {
  currentMonth: string
  currentMonthDisplay: string
  changeMonth: (direction: "prev" | "next") => void
}

const MonthContext = createContext<MonthContextType | undefined>(undefined)

export function MonthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const monthParam = searchParams.get("month")
    if (monthParam) {
      return monthParam
    }
    const now = new Date()
    const day = now.getDate()

    // If today is on or after the 24th, we're in next month's cycle
    if (day >= 24) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return nextMonth.toISOString().split("T")[0]
    }

    // Otherwise, we're in current month's cycle
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  })

  useEffect(() => {
    const monthParam = searchParams.get("month")
    if (monthParam !== currentMonth) {
      router.push(`/dashboard?month=${currentMonth}`, { scroll: false })
    }
  }, [currentMonth, router, searchParams])

  const changeMonth = (direction: "prev" | "next") => {
    const [year, month, day] = currentMonth.split("-").map(Number)

    let newYear = year
    let newMonth = month

    if (direction === "prev") {
      newMonth -= 1
      if (newMonth < 1) {
        newMonth = 12
        newYear -= 1
      }
    } else {
      newMonth += 1
      if (newMonth > 12) {
        newMonth = 1
        newYear += 1
      }
    }

    // Format as YYYY-MM-01
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, "0")}-01`

    setCurrentMonth(newMonthStr)
  }

  const currentMonthDisplay = new Date(currentMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <MonthContext.Provider value={{ currentMonth, currentMonthDisplay, changeMonth }}>{children}</MonthContext.Provider>
  )
}

export function useMonth() {
  const context = useContext(MonthContext)
  if (!context) {
    throw new Error("useMonth must be used within MonthProvider")
  }
  return context
}
