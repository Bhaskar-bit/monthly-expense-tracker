"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface PrivacyContextType {
  isMasked: boolean
  toggleMask: () => void
  formatAmount: (amount: number) => string
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isMasked, setIsMasked] = useState(true)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load mask preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("privacy-mask")
    if (saved !== null) {
      setIsMasked(saved === "true")
    }
    setIsLoaded(true)
    console.log("[v0] Privacy mask loaded from localStorage:", saved)
  }, [])

  // Save mask preference to localStorage when it changes
  const toggleMask = () => {
    setIsMasked((prev) => {
      const newValue = !prev
      localStorage.setItem("privacy-mask", String(newValue))
      console.log("[v0] Privacy mask toggled to:", newValue)
      return newValue
    })
  }

  // Format amount with masking
  const formatAmount = (amount: number) => {
    if (isMasked) {
      return "₹••••••"
    }
    return `₹${amount.toFixed(2)}`
  }

  // Don't render children until we've loaded the preference from localStorage
  if (!isLoaded) {
    return null
  }

  return <PrivacyContext.Provider value={{ isMasked, toggleMask, formatAmount }}>{children}</PrivacyContext.Provider>
}

export function usePrivacyMask() {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error("usePrivacyMask must be used within PrivacyProvider")
  }
  return context
}
