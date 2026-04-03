import { describe, it, expect } from "vitest"
import {
  getCustomMonthCycle,
  getMonthForExpenseDate,
  isExpenseInCycle,
} from "../lib/utils/custom-month-cycle"

describe("getCustomMonthCycle", () => {
  it("returns correct start/end for a mid-year month", () => {
    const cycle = getCustomMonthCycle("2025-06-01")
    expect(cycle.startDate).toBe("2025-05-24")
    expect(cycle.endDate).toBe("2025-06-23")
    expect(cycle.displayMonth).toBe("2025-06")
  })

  it("crosses year boundary for January", () => {
    const cycle = getCustomMonthCycle("2026-01-01")
    expect(cycle.startDate).toBe("2025-12-24")
    expect(cycle.endDate).toBe("2026-01-23")
  })

  it("returns the display name in the correct format", () => {
    const cycle = getCustomMonthCycle("2025-12-01")
    expect(cycle.displayName).toMatch(/December 2025/)
  })
})

describe("getMonthForExpenseDate", () => {
  it("expense before 24th belongs to the current month cycle", () => {
    expect(getMonthForExpenseDate("2025-06-10")).toBe("2025-06-01")
  })

  it("expense on the 23rd belongs to the current month cycle", () => {
    expect(getMonthForExpenseDate("2025-06-23")).toBe("2025-06-01")
  })

  it("expense on the 24th belongs to the NEXT month cycle", () => {
    expect(getMonthForExpenseDate("2025-06-24")).toBe("2025-07-01")
  })

  it("expense on the 31st belongs to the NEXT month cycle", () => {
    expect(getMonthForExpenseDate("2025-12-31")).toBe("2026-01-01")
  })

  it("December 24 wraps to January of next year", () => {
    expect(getMonthForExpenseDate("2025-12-24")).toBe("2026-01-01")
  })
})

describe("isExpenseInCycle", () => {
  it("returns true for expense on the cycle start date", () => {
    expect(isExpenseInCycle("2025-05-24", "2025-06-01")).toBe(true)
  })

  it("returns true for expense on the cycle end date", () => {
    expect(isExpenseInCycle("2025-06-23", "2025-06-01")).toBe(true)
  })

  it("returns false for expense before the cycle start", () => {
    expect(isExpenseInCycle("2025-05-23", "2025-06-01")).toBe(false)
  })

  it("returns false for expense after the cycle end", () => {
    expect(isExpenseInCycle("2025-06-24", "2025-06-01")).toBe(false)
  })
})
