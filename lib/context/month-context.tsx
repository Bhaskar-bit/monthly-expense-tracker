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
    // Default to current month
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  })

  useEffect(() => {
    console.log("[v0] MonthContext - currentMonth changed:", currentMonth)
    const monthParam = searchParams.get("month")
    console.log("[v0] MonthContext - URL month param:", monthParam)
    if (monthParam !== currentMonth) {
      console.log("[v0] MonthContext - Updating URL to:", currentMonth)
      router.push(`/dashboard?month=${currentMonth}`, { scroll: false })
    }
  }, [currentMonth, router, searchParams])

  const changeMonth = (direction: "prev" | "next") => {
    console.log("[v0] changeMonth called with direction:", direction)
    console.log("[v0] Current month before change:", currentMonth)

    const [year, month, day] = currentMonth.split("-").map(Number)
    console.log("[v0] Parsed date components:", { year, month, day })

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

    console.log("[v0] New date components:", { newYear, newMonth })

    // Format as YYYY-MM-01
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, "0")}-01`
    console.log("[v0] New month calculated:", newMonthStr)

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
