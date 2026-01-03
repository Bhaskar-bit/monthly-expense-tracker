"use client"

import { useEffect, useRef, useCallback } from "react"

const IDLE_TIMEOUT = 60 * 60 * 1000 // 1 hour in milliseconds
const WARNING_TIME = 5 * 60 * 1000 // Show warning 5 minutes before logout

export function useIdleTimeout(onTimeout: () => void, onWarning?: (timeLeft: number) => void) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    lastActivityRef.current = Date.now()

    // Set warning timer (shows 5 minutes before timeout)
    warningRef.current = setTimeout(() => {
      const timeLeft = IDLE_TIMEOUT - WARNING_TIME
      onWarning?.(timeLeft)
    }, IDLE_TIMEOUT - WARNING_TIME)

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      onTimeout()
    }, IDLE_TIMEOUT)
  }, [onTimeout, onWarning])

  useEffect(() => {
    // Initialize timer
    resetTimer()

    // Track user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"]

    const handleActivity = () => {
      resetTimer()
    }

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true)
    })

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [resetTimer])

  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
  }
}
