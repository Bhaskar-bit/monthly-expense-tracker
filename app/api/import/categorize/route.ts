/**
 * POST /api/import/categorize
 *
 * Takes an array of raw transaction descriptions and returns AI-suggested
 * categories + confidence scores using OpenAI structured outputs.
 * Max 100 transactions per call.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateText } from "ai"
import { EXPENSE_CATEGORIES } from "@/lib/types"
import { toSafeApiError } from "@/lib/utils/safe-error"
import type { RawTransaction } from "../parse/route"

const MAX_BATCH = 100

export interface CategorizedTransaction extends RawTransaction {
  ai_category: string | null
  ai_confidence: number
}

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { transactions } = body as { transactions: RawTransaction[] }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "transactions array is required" }, { status: 400 })
    }

    const batch = transactions.slice(0, MAX_BATCH)

    const categorized = await categorizeBatch(batch)

    return NextResponse.json({ transactions: categorized })
  } catch (err) {
    console.error("[import/categorize]", err)
    const { error, status } = toSafeApiError(err)
    return NextResponse.json({ error }, { status })
  }
}

async function categorizeBatch(transactions: RawTransaction[]): Promise<CategorizedTransaction[]> {
  const categoryList = EXPENSE_CATEGORIES.join(", ")

  const transactionLines = transactions
    .map((t, i) => `${i + 1}. "${t.raw_description}" — ₹${t.raw_amount} on ${t.raw_date}`)
    .join("\n")

  const systemPrompt = `You are a financial transaction categorizer for Indian bank statements.

Available categories: ${categoryList}

Categorization guide:
- Investments: SIP, mutual funds, stocks, demat, Zerodha, Groww, ELSS
- EMIs: home loan, car loan, personal loan EMI
- Monthly Fixed Expenses: rent, electricity, gas, internet, mobile recharge, OTT subscriptions, insurance premiums
- Cab Expense: Ola, Uber, Rapido, auto, taxi
- Food Apps Expense: Swiggy, Zomato, food delivery
- Quick Order Apps Expense: Blinkit, Zepto, Instamart, BigBasket, Dunzo, quick commerce
- Shopping Apps Expense: Amazon, Flipkart, Myntra, Ajio, Nykaa, Meesho
- Travel Expenses: flights (IndiGo, Air India, SpiceJet), trains (IRCTC), hotels, bus bookings
- Credit card bills: CC bill payment, credit card outstanding
- Miscellaneous: ATM withdrawal, hospital, medical, education, any that don't fit above

Respond ONLY with a valid JSON array. Each item must have:
- "index": 1-based number matching the input
- "category": one of the exact category names above, or null if unclear
- "confidence": float between 0.0 and 1.0`

  const userPrompt = `Categorize these ${transactions.length} transactions:\n\n${transactionLines}`

  const { text } = await generateText({
    model: "openai/gpt-4o-mini" as any,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
  })

  // Parse the response
  let results: { index: number; category: string | null; confidence: number }[] = []
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) results = JSON.parse(jsonMatch[0])
  } catch {
    // If parsing fails, return with null categories (user can categorize manually)
    return transactions.map((t) => ({ ...t, ai_category: null, ai_confidence: 0 }))
  }

  return transactions.map((t, i) => {
    const result = results.find((r) => r.index === i + 1)
    const validCategory = result?.category && (EXPENSE_CATEGORIES as string[]).includes(result.category)
      ? result.category
      : null
    return {
      ...t,
      ai_category: validCategory,
      ai_confidence: result?.confidence ?? 0,
    }
  })
}
