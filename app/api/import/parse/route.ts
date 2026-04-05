/**
 * POST /api/import/parse
 *
 * Accepts a bank statement file (CSV, XLSX, or PDF) as base64 + bank hint.
 * Returns raw parsed transactions — no DB writes at this stage.
 * The client reviews these before calling /api/import/confirm.
 *
 * Supported:  CSV (built-in parser, no dependency)
 *             XLSX (requires `xlsx` package)
 *             PDF  (requires `pdf-parse` package)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { BANK_COLUMN_MAPS, resolveColumn, parseAmount, parseDate } from "@/lib/utils/bank-column-maps"
import type { ImportBank } from "@/lib/types"
import { toSafeApiError } from "@/lib/utils/safe-error"
import type { BankColumnMap } from "@/lib/utils/bank-column-maps"

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export interface RawTransaction {
  raw_description: string
  raw_amount: number
  raw_date: string        // YYYY-MM-DD
  raw_type: "debit" | "credit"
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { fileBase64, sourceType, bank } = body as {
      fileBase64: string
      sourceType: "csv" | "xlsx" | "pdf"
      bank: ImportBank
    }

    if (!fileBase64 || !sourceType) {
      return NextResponse.json({ error: "fileBase64 and sourceType are required" }, { status: 400 })
    }

    if (fileBase64.length > MAX_FILE_BYTES * 1.4) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 })
    }

    const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64
    const buffer = Buffer.from(base64Data, "base64")

    let transactions: RawTransaction[] = []

    if (sourceType === "csv") {
      transactions = parseCSV(buffer, bank)
    } else if (sourceType === "xlsx") {
      transactions = await parseXLSX(buffer, bank)
    } else if (sourceType === "pdf") {
      transactions = await parsePDF(buffer)
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
    }

    const expenses = transactions.filter(
      (t) => t.raw_type === "debit" && t.raw_amount > 0 && t.raw_date,
    )

    return NextResponse.json({ transactions: expenses, total: expenses.length })
  } catch (err) {
    console.error("[import/parse]", err)
    const { error, status } = toSafeApiError(err)
    return NextResponse.json({ error }, { status })
  }
}

// ── CSV Parser (no external dependency) ──────────────────────────────────────

function parseCSV(buffer: Buffer, bank: ImportBank): RawTransaction[] {
  const text = buffer.toString("utf-8")
  const colMap = bank !== "Generic" ? BANK_COLUMN_MAPS[bank as Exclude<ImportBank, "Generic">] : null
  const skipRows = colMap?.skipRows ?? 0

  const lines = text.split(/\r?\n/)
  const dataLines = skipRows > 0 ? lines.slice(skipRows) : lines

  // Find header row (first non-empty line)
  let headerIndex = 0
  while (headerIndex < dataLines.length && !dataLines[headerIndex]?.trim()) headerIndex++

  const headers = parseCSVLine(dataLines[headerIndex] ?? "")
  if (!headers.length) return []

  const rows: Record<string, string>[] = []
  for (let i = headerIndex + 1; i < dataLines.length; i++) {
    const line = dataLines[i]?.trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? "").trim() })
    rows.push(row)
  }

  return rows
    .map((row) => rowToTransaction(row, colMap))
    .filter((t): t is RawTransaction => t !== null)
}

/** Parse a single CSV line, respecting quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── XLSX Parser (requires `xlsx` package) ────────────────────────────────────

async function parseXLSX(buffer: Buffer, bank: ImportBank): Promise<RawTransaction[]> {
  let XLSX: typeof import("xlsx")
  try {
    XLSX = await import("xlsx")
  } catch {
    throw new Error("XLSX parsing requires the 'xlsx' package. Please use CSV export instead.")
  }

  const colMap = bank !== "Generic" ? BANK_COLUMN_MAPS[bank as Exclude<ImportBank, "Generic">] : null
  const skipRows = colMap?.skipRows ?? 0

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    raw: false,
    defval: "",
    range: skipRows,
  })

  return raw
    .map((row) => rowToTransaction(row, colMap))
    .filter((t): t is RawTransaction => t !== null)
}

// ── PDF Parser (requires `pdf-parse` package) ─────────────────────────────────

async function parsePDF(buffer: Buffer): Promise<RawTransaction[]> {
  let text: string
  try {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    text = result.text
  } catch {
    throw new Error("PDF parsing requires the 'pdf-parse' package. Please use CSV export instead.")
  }

  if (!text?.trim()) {
    throw new Error("PDF appears to be empty or image-only. Please use CSV export.")
  }

  return extractTransactionsFromPDFText(text)
}

function extractTransactionsFromPDFText(text: string): RawTransaction[] {
  const transactions: RawTransaction[] = []
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/

  for (const line of lines) {
    const dateMatch = line.match(datePattern)
    if (!dateMatch) continue
    const date = parseDate(dateMatch[1])
    if (!date) continue

    const amounts = line.match(/[\d,]+\.?\d*/g)
    if (!amounts || amounts.length < 2) continue
    const amount = parseAmount(amounts[amounts.length - 2])
    if (amount <= 0) continue

    const desc = line
      .replace(dateMatch[1], "")
      .replace(/[\d,]+\.?\d*/g, "")
      .replace(/[\/\-\|]/g, " ")
      .trim()
      .slice(0, 200)
    if (desc.length < 3) continue

    transactions.push({ raw_description: desc, raw_amount: amount, raw_date: date, raw_type: "debit" })
  }

  return transactions
}

// ── Row → RawTransaction ──────────────────────────────────────────────────────

function rowToTransaction(
  row: Record<string, string>,
  colMap: BankColumnMap | null,
): RawTransaction | null {
  let dateStr: string
  let description: string
  let debitStr: string
  let creditStr: string

  if (colMap) {
    dateStr = resolveColumn(row, colMap.date)
    description = resolveColumn(row, colMap.description)
    debitStr = resolveColumn(row, colMap.debit)
    creditStr = resolveColumn(row, colMap.credit)
  } else {
    const keys = Object.keys(row)
    const dateKey = keys.find((k) => /date/i.test(k)) ?? ""
    const descKey = keys.find((k) => /narr|desc|remark|particular/i.test(k)) ?? ""
    const debitKey = keys.find((k) => /debit|withdraw|dr/i.test(k)) ?? ""
    const creditKey = keys.find((k) => /credit|deposit|cr/i.test(k)) ?? ""
    dateStr = row[dateKey] ?? ""
    description = row[descKey] ?? ""
    debitStr = row[debitKey] ?? ""
    creditStr = row[creditKey] ?? ""
  }

  const date = parseDate(dateStr)
  if (!date) return null
  description = description.trim()
  if (!description) return null

  const debit = parseAmount(debitStr)
  const credit = parseAmount(creditStr)
  if (debit <= 0 && credit <= 0) return null

  return {
    raw_description: description.slice(0, 300),
    raw_amount: debit > 0 ? debit : credit,
    raw_date: date,
    raw_type: debit > 0 ? "debit" : "credit",
  }
}
