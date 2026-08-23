/**
 * Statement import pipeline: extraction -> parse -> classify.
 *
 * The PDF used here is synthesised in-test with the columns emitted out of
 * visual order, because that is the failure the coordinate-grouping extractor
 * exists to prevent. A test built on already-ordered text would pass without
 * proving anything.
 */

import { describe, it, expect } from "vitest"
import { parseIciciStatement, verifyChain } from "@/lib/icici-statement-parser"
import { classify, shouldAutoConfirm, type Registry } from "@/lib/transaction-classifier"
import { extractStatementText, passwordCandidates } from "@/lib/pdf-extract"

const REGISTRY: Registry = { ownAccounts: [], incomePatterns: [/salary/i, /\bSAL\b/] }
const NO_LEARNED = new Map<string, never>()

/** One visual row of the statement: text pieces at explicit x offsets. */
type Row = Array<[x: number, text: string]>

const STATEMENT_ROWS: Row[] = [
  [[40, "DATE"], [110, "MODE**"], [200, "PARTICULARS"], [400, "DEPOSITS"], [470, "WITHDRAWALS"], [550, "BALANCE"]],
  [[40, "01-04-2026"], [110, "B/F"], [550, "50,000.00"]],
  [[40, "02-04-2026"], [110, "UPI"], [200, "UPI/412345678901/Pay/swiggy@ybl/SWIGGY"], [470, "450.00"], [550, "49,550.00"]],
  [[200, "SWIGGY LIMITED"]],
  [[40, "05-04-2026"], [110, "EBA"], [200, "EBA/ISEC/ICICIDIRECT ALLOCATION"], [470, "10,000.00"], [550, "39,550.00"]],
  [[200, "ICICI SECURITIES"]],
  [[40, "07-04-2026"], [110, "INF"], [200, "INF/INFT/SELF ACCOUNT SWEEP"], [470, "5,000.00"], [550, "34,550.00"]],
  [[200, "OWN SAVINGS ACCOUNT"]],
  [[40, "12-04-2026"], [110, "UPI"], [200, "UPI/512345678902/Pay/uber@icici/UBER"], [470, "312.50"], [550, "34,237.50"]],
  [[200, "UBER INDIA SYSTEMS"]],
  [[40, "30-04-2026"], [110, "ACH"], [200, "ACH/SALARY CREDIT ACME LTD"], [400, "1,00,000.00"], [550, "1,34,237.50"]],
  [[200, "ACME PAYROLL"]],
  [[40, "30-04-2026"], [110, "C/F"], [550, "1,34,237.50"]],
]

// ── minimal PDF writer ────────────────────────────────────────────────────────

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

/**
 * Emit each text piece as its own positioned Tj, with the pieces of each row
 * shuffled so document order never matches visual order.
 */
function buildContentStream(rows: Row[]): string {
  const parts: string[] = []
  let y = 750
  for (const row of rows) {
    const shuffled = [...row].reverse()
    for (const [x, text] of shuffled) {
      parts.push(`BT /F1 9 Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`)
    }
    y -= 14
  }
  return parts.join("\n")
}

function buildPdf(rows: Row[]): Uint8Array {
  const content = buildContentStream(rows)
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${Buffer.byteLength(content, "latin1")}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new Uint8Array(Buffer.from(pdf, "latin1"))
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("extractStatementText", () => {
  it("rebuilds visual rows from out-of-order text items", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const lines = text.split("\n")

    expect(lines[1]).toBe("01-04-2026 B/F 50,000.00")
    expect(lines[2]).toBe("02-04-2026 UPI UPI/412345678901/Pay/swiggy@ybl/SWIGGY 450.00 49,550.00")
    expect(lines[3]).toBe("SWIGGY LIMITED")
    // The balance column must land at the end of the row, not inside narration.
    expect(lines[2].endsWith("49,550.00")).toBe(true)
  })
})

describe("parseIciciStatement", () => {
  it("reads the chain, direction and amounts from a synthesised statement", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const parsed = parseIciciStatement(text)

    expect(parsed.warnings).toEqual([])
    expect(parsed.openingBalance).toBe(50000)
    expect(parsed.closingBalance).toBe(134237.5)
    // B/F and C/F markers are not transactions.
    expect(parsed.transactions).toHaveLength(5)

    const [swiggy, isec, inf, uber, salary] = parsed.transactions

    expect(swiggy).toMatchObject({ date: "2026-04-02", amount: 450, direction: "debit", mode: "UPI", reconciled: true })
    expect(swiggy.merchant).toBe("SWIGGY LIMITED")
    expect(swiggy.counterpartyVpa).toBe("swiggy@ybl")

    expect(isec).toMatchObject({ date: "2026-04-05", amount: 10000, direction: "debit", mode: "EBA" })
    expect(inf).toMatchObject({ date: "2026-04-07", amount: 5000, direction: "debit", mode: "INF" })
    expect(uber).toMatchObject({ date: "2026-04-12", amount: 312.5, direction: "debit" })
    expect(salary).toMatchObject({ date: "2026-04-30", amount: 100000, direction: "credit" })
  })

  it("verifies the chain against the printed closing balance", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const parsed = parseIciciStatement(text)

    expect(verifyChain(parsed, 134237.5).ok).toBe(true)

    const bad = verifyChain(parsed, 140000)
    expect(bad.ok).toBe(false)
    expect(bad.discrepancy).toBeCloseTo(-5762.5, 2)
  })

  it("flags a row where the printed amount and the balance movement disagree", () => {
    const text = [
      "01-04-2026 B/F 10,000.00",
      "02-04-2026 UPI UPI/1/Pay/x@ybl/X 100.00 9,750.00",
    ].join("\n")

    const parsed = parseIciciStatement(text)
    expect(parsed.transactions[0].reconciled).toBe(false)
    // The balance chain wins: it is arithmetic, not layout.
    expect(parsed.transactions[0].amount).toBe(250)
    expect(parsed.warnings.some((w) => w.includes("flagged for review"))).toBe(true)
  })
})

describe("classify", () => {
  it("routes each mode and merchant to the right category and kind", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const { transactions } = parseIciciStatement(text)
    const results = transactions.map((t) => classify(t, REGISTRY, NO_LEARNED))

    expect(results[0]).toMatchObject({ category: "Food Apps Expense", kind: "EXPENSE" })
    expect(results[1]).toMatchObject({ category: "Investments", kind: "TRANSFER_SAVINGS" })
    expect(results[2]).toMatchObject({ category: "Miscellaneous", kind: "TRANSFER_INTERNAL" })
    expect(results[3]).toMatchObject({ category: "Cab Expense", kind: "EXPENSE" })
    expect(results[4]).toMatchObject({ kind: "INCOME" })
  })

  it("only ticks EXPENSE rows — investments and sweeps arrive unticked", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const { transactions } = parseIciciStatement(text)

    const selected = transactions.map((t) => {
      const c = classify(t, REGISTRY, NO_LEARNED)
      return shouldAutoConfirm(t, c) && c.kind === "EXPENSE"
    })

    expect(selected).toEqual([true, false, false, true, false])
  })

  it("lets a previous user correction outrank every rule", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const { transactions } = parseIciciStatement(text)
    const learned = new Map([["swiggy limited", "Miscellaneous" as const]])

    expect(classify(transactions[0], REGISTRY, learned)).toMatchObject({
      category: "Miscellaneous",
      source: "learned",
    })
  })
})

describe("passwordCandidates", () => {
  it("generates the case and date-format variants without duplicates", () => {
    const out = passwordCandidates("Bhaskar", "01-02-1990")
    expect(out).toContain("BHAS0102")
    expect(out).toContain("bhas010290")
    expect(out).toContain("Bhas01021990")
    expect(new Set(out).size).toBe(out.length)
  })
})
