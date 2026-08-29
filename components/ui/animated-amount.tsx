"use client"

import { useEffect, useRef, useState } from "react"
import { usePrivacyMask } from "@/lib/context/privacy-context"
import { cn } from "@/lib/utils"

const DURATION_MS = 650

/**
 * Respect the OS "reduce motion" setting. A count-up is decorative; for someone
 * who has asked for less movement it is just the number being briefly wrong.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  return reduced
}

interface AnimatedAmountProps {
  value: number
  className?: string
}

/**
 * A currency figure that counts up to its value instead of snapping to it.
 *
 * Two things it deliberately does not do:
 *
 *  - Animate while amounts are masked. Watching "₹••••••" tick would be absurd,
 *    and it would leak the magnitude of a number the user asked to hide.
 *  - Reflow while counting. Proportional digits change width as they change
 *    value, so an un-tabular count-up makes the whole card jitter; `tabular-nums`
 *    holds every digit to the same advance width.
 */
export function AnimatedAmount({ value, className }: AnimatedAmountProps) {
  const { isMasked, formatAmount } = usePrivacyMask()
  const reducedMotion = usePrefersReducedMotion()

  const [display, setDisplay] = useState(value)
  const [isCounting, setIsCounting] = useState(false)
  // Where the next animation starts from — the value currently on screen, so an
  // interrupted count continues from where it got to rather than jumping back.
  const displayRef = useRef(value)
  const frameRef = useRef<number | undefined>(undefined)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (isMasked || reducedMotion) {
      setDisplay(value)
      displayRef.current = value
      setIsCounting(false)
      return
    }

    // First paint counts up from zero; later changes count from the old figure.
    const from = hasMounted.current ? displayRef.current : 0
    hasMounted.current = true

    if (from === value) return

    const start = performance.now()
    setIsCounting(true)

    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      // easeOutQuart: most of the distance early, settling gently.
      const eased = 1 - Math.pow(1 - progress, 4)
      const next = from + (value - from) * eased

      displayRef.current = next
      setDisplay(next)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        displayRef.current = value
        setIsCounting(false)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
    }
  }, [value, isMasked, reducedMotion])

  // While counting, show whole rupees: two decimal places changing 60 times a
  // second is visual noise, not information. The exact figure, paise included,
  // lands the moment it settles.
  const shown = isCounting ? Math.round(display) : value

  return <span className={cn("tabular-nums", className)}>{formatAmount(shown)}</span>
}
