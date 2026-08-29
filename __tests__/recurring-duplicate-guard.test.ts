/**
 * The duplicate guard for recurring expenses.
 *
 * shouldCreateForMonth returns true for every monthly rule and never consults
 * last_created_date, so expenseExistsInMonth is the ONLY thing preventing a
 * second copy of an EMI. It used to return false on error — "no expense
 * exists, go ahead and create one" — which turned any transient failure into a
 * duplicated financial record.
 */

import { describe, it, expect, vi } from "vitest"
import { recurringExpenseProcessor } from "@/lib/services/recurring-expense-processor"
import type { RecurringExpense } from "@/lib/types"

const RULE = {
  id: "rule-1",
  user_id: "user-1",
  category: "EMIs",
  amount: 53564,
  description: "HL",
  frequency: "monthly",
  start_date: "2026-05-10",
  end_date: null,
  day_of_month: null,
  last_created_date: "2026-08-01",
  is_active: true,
} as unknown as RecurringExpense

/** Minimal PostgREST-shaped stub: chainable filters, terminal `single`/`limit`. */
function stubClient(handlers: {
  months?: () => { data: unknown; error: unknown }
  expenses?: () => { data: unknown; error: unknown }
}) {
  return {
    from(table: string) {
      const result =
        table === "months"
          ? handlers.months?.() ?? { data: { id: "month-1" }, error: null }
          : handlers.expenses?.() ?? { data: [], error: null }

      const chain: Record<string, unknown> = {}
      for (const method of ["select", "eq", "order"]) {
        chain[method] = () => chain
      }
      chain.single = () => Promise.resolve(result)
      chain.limit = () => Promise.resolve(result)
      return chain
    },
  }
}

describe("expenseExistsInMonth", () => {
  it("reports an existing expense when one is present", async () => {
    const client = stubClient({ expenses: () => ({ data: [{ id: "e1" }], error: null }) })

    const exists = await recurringExpenseProcessor.expenseExistsInMonth(
      client, "user-1", "2026-08", RULE,
    )
    expect(exists).toBe(true)
  })

  it("reports no expense when the month is genuinely empty", async () => {
    const client = stubClient({ expenses: () => ({ data: [], error: null }) })

    const exists = await recurringExpenseProcessor.expenseExistsInMonth(
      client, "user-1", "2026-08", RULE,
    )
    expect(exists).toBe(false)
  })

  it("fails closed when the expenses lookup errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const client = stubClient({
      expenses: () => ({ data: null, error: new Error("network blip") }),
    })

    // Not false. False means "create it", and creating on a failed check is
    // exactly how an EMI got written twice.
    const exists = await recurringExpenseProcessor.expenseExistsInMonth(
      client, "user-1", "2026-08", RULE,
    )
    expect(exists).toBe(true)
    spy.mockRestore()
  })

  it("fails closed when the month lookup errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const client = stubClient({
      months: () => ({ data: null, error: new Error("rate limited") }),
    })

    const exists = await recurringExpenseProcessor.expenseExistsInMonth(
      client, "user-1", "2026-08", RULE,
    )
    expect(exists).toBe(true)
    spy.mockRestore()
  })

  it("still reports absence when the month row itself does not exist", async () => {
    // No month means nothing can have been created in it — a real absence,
    // distinct from a failed lookup.
    const client = stubClient({ months: () => ({ data: null, error: null }) })

    const exists = await recurringExpenseProcessor.expenseExistsInMonth(
      client, "user-1", "2026-08", RULE,
    )
    expect(exists).toBe(false)
  })
})
