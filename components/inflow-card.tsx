"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Check, X, TrendingUp, ArrowDownRight } from "lucide-react"
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
    <Card className="shadow-lg border-0 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Monthly Income
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            This Month's Inflow
          </Label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                value={tempInflow}
                onChange={(e) => setTempInflow(e.target.value)}
                placeholder="Enter amount"
                className="text-lg font-semibold h-12"
              />
              <Button size="icon" variant="default" onClick={handleSave} className="h-12 w-12">
                <Check className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setTempInflow(inflow.toString())
                }}
                className="h-12 w-12"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-3xl font-bold text-primary">{formatAmount(inflow)}</p>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsEditing(true)
                  setTempInflow(inflow.toString())
                }}
                className="h-10 w-10"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5" />
            Carried Forward
          </Label>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-2xl font-semibold text-muted-foreground">{formatAmount(carryover)}</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="p-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
            <Label className="text-xs font-medium uppercase tracking-wide opacity-90">Total Available</Label>
            <p className="text-3xl font-bold mt-1">{formatAmount(totalAvailable)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
