"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Check, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useMonthData } from "@/lib/hooks/use-month-data"
import { mutate } from "swr"
import { useMonth } from "@/lib/context/month-context"
import { usePrivacyMask } from "@/lib/context/privacy-context"

export function InflowCard() {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [tempInflow, setTempInflow] = useState<string>("")

  const { currentMonth } = useMonth()
  const { formatAmount } = usePrivacyMask()

  const { data: monthData } = useMonthData(currentMonth)

  const inflow = monthData ? Number(monthData.inflow) : 0
  const carryover = monthData ? Number(monthData.carryover_from_previous) : 0

  const handleSave = async () => {
    if (!monthData?.id) return

    const supabase = createClient()
    const newInflow = Number.parseFloat(tempInflow) || 0

    const { error } = await supabase.from("months").update({ inflow: newInflow }).eq("id", monthData.id)

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update inflow",
        variant: "destructive",
      })
    } else {
      setIsEditing(false)
      toast({
        title: "Success",
        description: "Inflow updated successfully",
      })
      mutate(`month-${currentMonth}`)
    }
  }

  const totalAvailable = inflow + carryover

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Monthly Inflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Current Month Inflow</Label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={tempInflow}
                onChange={(e) => setTempInflow(e.target.value)}
                placeholder="Enter amount"
              />
              <Button size="icon" variant="default" onClick={handleSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setTempInflow(inflow.toString())
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatAmount(inflow)}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditing(true)
                  setTempInflow(inflow.toString())
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Carryover from Previous Month</Label>
          <p className="text-xl font-semibold text-muted-foreground">{formatAmount(carryover)}</p>
        </div>

        <div className="pt-2 border-t">
          <Label>Total Available</Label>
          <p className="text-2xl font-bold text-primary">{formatAmount(totalAvailable)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
