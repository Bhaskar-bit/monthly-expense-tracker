/**
 * POST /api/import/confirm
 *
 * Bulk-creates approved transactions from an import session.
 * Called after the user reviews and confirms in the import wizard.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getMonthForExpenseDate } from "@/lib/utils/custom-month-cycle"
import { toSafeApiError } from "@/lib/utils/safe-error"
import type { ExpenseCategory, ImportBank, ImportSourceType } from "@/lib/types"

interface ConfirmTransaction {
  raw_description: string
  raw_amount: number
  raw_date: string
  category: ExpenseCategory
  description: string
  expense_source: "savings_account" | "credit_card"
}

interface ConfirmRequest {
  transactions: ConfirmTransaction[]
  bank: ImportBank
  sourceType: ImportSourceType
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body: ConfirmRequest = await request.json()
    const { transactions, bank, sourceType } = body

    if (!transactions?.length) {
      return NextResponse.json({ error: "No transactions to import" }, { status: 400 })
    }

    // 1. Create import session record
    const { data: session, error: sessionError } = await supabase
      .from("import_sessions")
      .insert({
        user_id: user.id,
        source_type: sourceType,
        source_bank: bank,
        status: "confirmed",
        raw_count: transactions.length,
        confirmed_count: transactions.length,
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // 2. For each transaction, ensure the month record exists and create the expense
    let created = 0
    let failed = 0
    const errors: string[] = []

    for (const txn of transactions) {
      try {
        const monthYear = getMonthForExpenseDate(txn.raw_date)

        // Get or create month
        const { data: monthData } = await supabase
          .from("months")
          .select("id")
          .eq("user_id", user.id)
          .eq("month_year", monthYear)
          .maybeSingle()

        let monthId = monthData?.id

        if (!monthId) {
          const { data: newMonth } = await supabase
            .from("months")
            .insert({
              user_id: user.id,
              month_year: monthYear,
              inflow: 0,
              carryover_from_previous: 0,
            })
            .select()
            .single()
          monthId = newMonth?.id
        }

        if (!monthId) throw new Error(`Could not get month for ${txn.raw_date}`)

        // Create expense
        await supabase.from("expenses").insert({
          user_id: user.id,
          month_id: monthId,
          category: txn.category,
          amount: txn.raw_amount,
          description: txn.description || txn.raw_description,
          expense_date: txn.raw_date,
          expense_source: txn.expense_source,
        })

        created++
      } catch (err) {
        failed++
        errors.push(`${txn.raw_date} ${txn.raw_description}: ${err instanceof Error ? err.message : "unknown error"}`)
      }
    }

    return NextResponse.json({
      success: true,
      created,
      failed,
      sessionId: session.id,
      errors: errors.slice(0, 10), // return first 10 errors max
    })
  } catch (err) {
    console.error("[import/confirm]", err)
    const { error, status } = toSafeApiError(err)
    return NextResponse.json({ error }, { status })
  }
}
