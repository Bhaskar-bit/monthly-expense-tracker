"use client"

import { useEffect, useState } from "react"
import { AlertCircle, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { budgetService } from "@/lib/services/budget-service"
import { useMonth } from "@/lib/context/month-context"

export function BudgetAlertsDisplay() {
  const [alerts, setAlerts] = useState<any[]>([])
  const { currentMonth } = useMonth()

  useEffect(() => {
    fetchAlerts()
  }, [currentMonth])

  const fetchAlerts = async () => {
    try {
      const data = await budgetService.getBudgetAlerts(currentMonth)
      setAlerts(data)
    } catch (error) {
      console.error("[v0] Failed to fetch budget alerts:", error)
    }
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <Alert key={alert.id} variant={alert.alert_type === "exceeded" ? "destructive" : "default"}>
          <div className="flex items-start gap-3">
            {alert.alert_type === "exceeded" ? (
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            )}
            <AlertDescription className="text-sm">
              <strong>{alert.category}</strong>: You've{" "}
              {alert.alert_type === "exceeded" ? "exceeded" : "reached 80% of"} your monthly budget (₹
              {alert.spent_amount.toFixed(2)} / ₹{alert.budget_limit.toFixed(2)})
            </AlertDescription>
          </div>
        </Alert>
      ))}
    </div>
  )
}
