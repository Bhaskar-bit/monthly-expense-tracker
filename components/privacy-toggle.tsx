"use client"

import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { usePrivacyMask } from "@/lib/context/privacy-context"

export function PrivacyToggle() {
  const { isMasked, toggleMask } = usePrivacyMask()

  console.log("[v0] PrivacyToggle - isMasked:", isMasked)

  return (
    <Button variant="outline" size="sm" onClick={toggleMask}>
      {isMasked ? (
        <>
          <EyeOff className="w-4 h-4 mr-2" />
          Show Amounts
        </>
      ) : (
        <>
          <Eye className="w-4 h-4 mr-2" />
          Hide Amounts
        </>
      )}
    </Button>
  )
}
