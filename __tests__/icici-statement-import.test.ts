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
import { extractStatementText, extractWithCandidates, passwordCandidates } from "@/lib/pdf-extract"

const REGISTRY: Registry = { ownAccounts: [], incomePatterns: [/salary/i, /\bSAL\b/] }
const NO_LEARNED = new Map<string, never>()

/** One visual row of the statement: text pieces at explicit x offsets. */
type Row = Array<[x: number, text: string]>

/**
 * Modelled on a real ICICI savings statement, which matters in two ways the
 * first version of this fixture got wrong:
 *
 *  - The payee name is the FIRST line of the PARTICULARS block, and the date
 *    is vertically centred against the middle of that block. So in extracted
 *    text the name appears BEFORE the dated line, not after it.
 *  - The MODE column is empty; UPI/NEFT/ACH appear inside PARTICULARS.
 *  - There is no C/F row. Each page ends with a "Total:" row whose figures
 *    would otherwise be absorbed into the last transaction.
 */
const STATEMENT_ROWS: Row[] = [
  [[40, "DATE"], [110, "MODE"], [200, "PARTICULARS"], [400, "DEPOSITS"], [470, "WITHDRAWALS"], [550, "BALANCE"]],
  [[40, "01-04-2026"], [200, "B/F"], [550, "50,000.00"]],

  [[200, "SWIGGY LIMITED"]],
  [[40, "02-04-2026"], [200, "UPI/412345678901/Pay/swiggy@ybl/AXIS"], [470, "450.00"], [550, "49,550.00"]],
  [[200, "BANK/743917241826/AXIee91c62b78f048c7b7cf"]],
  [[200, "9a88f566327b"]],

  [[200, "ICICI SECURITIES"]],
  [[40, "05-04-2026"], [200, "EBA/ISEC/ICICIDIRECT ALLOCATION"], [470, "10,000.00"], [550, "39,550.00"]],

  [[200, "OWN SAVINGS ACCOUNT"]],
  [[40, "07-04-2026"], [200, "INF/INFT/SELF ACCOUNT SWEEP"], [470, "5,000.00"], [550, "34,550.00"]],

  [[200, "UBER INDIA SYSTEMS"]],
  [[40, "12-04-2026"], [200, "UPI/512345678902/Pay/uber@icici/ICICI"], [470, "312.50"], [550, "34,237.50"]],
  [[200, "Bank/618365369644/ICI92ca18e187bf44dfb2ee"]],
  [[200, "0/"]],

  [[200, "ACME PAYROLL"]],
  [[40, "30-04-2026"], [200, "ACH/SALARY CREDIT ACME LTD"], [400, "1,00,000.00"], [550, "1,34,237.50"]],

  [[250, "Total:"], [400, "1,00,000.00"], [470, "15,762.50"], [550, "1,34,237.50"]],
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
    // Payee name sits ABOVE the dated line, as ICICI prints it.
    expect(lines[2]).toBe("SWIGGY LIMITED")
    expect(lines[3]).toBe("02-04-2026 UPI/412345678901/Pay/swiggy@ybl/AXIS 450.00 49,550.00")
    // The balance column must land at the end of the row, not inside narration.
    expect(lines[3].endsWith("49,550.00")).toBe(true)
  })

  /**
   * pdfjs transfers the buffer it is given to its worker, detaching the
   * caller's array. Without an internal copy the second read gets an empty
   * buffer and throws DataCloneError — which is what broke every encrypted
   * statement, since those only succeed on a later password candidate.
   */
  it("leaves the caller's buffer intact so a retry can read it again", async () => {
    const bytes = buildPdf(STATEMENT_ROWS)
    const size = bytes.byteLength

    await extractStatementText(bytes)
    expect(bytes.byteLength).toBe(size)

    const second = await extractStatementText(bytes)
    expect(second.split("\n")[1]).toBe("01-04-2026 B/F 50,000.00")
  })
})

describe("extractWithCandidates", () => {
  it("keeps trying after a rejected password instead of dying on a spent buffer", async () => {
    // The empty password is not rejected by an unencrypted PDF, so drive the
    // retry path with candidates that must be walked in order.
    const text = await extractWithCandidates(buildPdf(STATEMENT_ROWS), ["wrong-1", "wrong-2", ""])
    expect(text).toContain("01-04-2026 B/F 50,000.00")
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
    // The payee, not a fragment of the wrapped reference string.
    expect(swiggy.merchant).not.toMatch(/\d{6,}/)
    expect(swiggy.merchant).toBe("SWIGGY LIMITED")
    expect(swiggy.counterpartyVpa).toBe("swiggy@ybl")

    expect(isec).toMatchObject({ date: "2026-04-05", amount: 10000, direction: "debit", mode: "EBA" })
    expect(inf).toMatchObject({ date: "2026-04-07", amount: 5000, direction: "debit", mode: "INF" })
    expect(uber).toMatchObject({ date: "2026-04-12", amount: 312.5, direction: "debit" })
    expect(salary).toMatchObject({ date: "2026-04-30", amount: 100000, direction: "credit" })
  })

  /**
   * The totals row carries three currency figures and no date, so before it was
   * filtered it was appended to the final transaction — whose "printed amount"
   * then became the page's withdrawals total. That is where the real
   * "printed 116905 vs balance movement 13499.99" warning came from.
   */
  it("reads the totals row as the closing balance instead of folding it into a transaction", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const parsed = parseIciciStatement(text)

    expect(parsed.printedClosingBalance).toBe(134237.5)
    expect(parsed.transactions.at(-1)).toMatchObject({ amount: 100000, direction: "credit" })
    expect(parsed.warnings).toEqual([])
  })

  it("takes the payee name from above the dated line, not the wrapped reference", async () => {
    const text = await extractStatementText(buildPdf(STATEMENT_ROWS))
    const { transactions } = parseIciciStatement(text)

    expect(transactions.map((t) => t.merchant)).toEqual([
      "SWIGGY LIMITED",
      "ICICI SECURITIES",
      "OWN SAVINGS ACCOUNT",
      "UBER INDIA SYSTEMS",
      "ACME PAYROLL",
    ])
    // No merchant may carry a per-transaction reference number: such a key
    // never recurs, so learned categorisations keyed on it are worthless.
    for (const t of transactions) expect(t.merchant).not.toMatch(/\d{6,}/)
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
