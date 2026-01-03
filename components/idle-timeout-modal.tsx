"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useIdleTimeout } from "@/lib/hooks/use-idle-timeout"
import { logoutAction } from "@/lib/actions/auth-actions"

export function IdleTimeoutModal() {
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)

  const handleTimeout = async () => {
    await logoutAction()
  }

  const handleWarning = (time: number) => {
    setShowWarning(true)
    setTimeLeft(Math.floor(time / 1000)) // Convert to seconds
  }

  useEffect(() => {
    if (!showWarning) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [showWarning])

  // Setup idle timeout monitoring
  useIdleTimeout(handleTimeout, handleWarning)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleStayActive = () => {
    setShowWarning(false)
    setTimeLeft(0)
  }

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Session Timeout Warning</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire due to inactivity in{" "}
            <span className="font-semibold text-foreground">{formatTime(timeLeft)}</span>. Stay active to continue or
            you'll be logged out.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-3">
          <AlertDialogCancel onClick={handleStayActive}>Stay Active</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleTimeout}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Logout Now
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
