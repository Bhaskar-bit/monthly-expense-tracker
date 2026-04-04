/**
 * Bank-specific CSV/XLSX column mappings for top 10 Indian banks.
 * Each map defines how to read date, description, debit, credit columns
 * from that bank's standard export format.
 */

import type { ImportBank } from "@/lib/types"

export interface BankColumnMap {
  date: string | string[]         // column header(s) for transaction date
  description: string | string[]  // column header(s) for narration/description
  debit: string | string[]        // column header for debit / withdrawal
  credit: string | string[]       // column header for credit / deposit
  balance?: string | string[]     // optional: running balance column
  /** Row index (0-based) where the actual data header row is. Default: 0 */
  headerRow?: number
  /** Some banks put junk rows at the top before the header. Skip these many rows. */
  skipRows?: number
}

export const BANK_COLUMN_MAPS: Record<Exclude<ImportBank, "Generic">, BankColumnMap> = {
  HDFC: {
    date: ["Date", "Txn Date", "Value Dt"],
    description: ["Narration", "Description", "Particulars"],
    debit: ["Withdrawal Amt.", "Debit", "Withdrawal Amount(INR)"],
    credit: ["Deposit Amt.", "Credit", "Deposit Amount(INR)"],
    balance: ["Closing Balance"],
    skipRows: 21, // HDFC prepends account info before the table
  },

  ICICI: {
    date: ["Transaction Date", "Date"],
    description: ["Transaction Remarks", "Remarks", "Narration"],
    debit: ["Withdrawal Amount (INR )", "Withdrawal Amount (INR)", "Debit"],
    credit: ["Deposit Amount (INR )", "Deposit Amount (INR)", "Credit"],
    balance: ["Balance (INR )"],
  },

  SBI: {
    date: ["Txn Date", "Date", "VALUE DATE"],
    description: ["Description", "Particulars", "DESCRIPTION"],
    debit: ["Debit", "DR", "DEBIT(INR)"],
    credit: ["Credit", "CR", "CREDIT(INR)"],
    balance: ["Balance", "BALANCE(INR)"],
  },

  Axis: {
    date: ["Tran Date", "Transaction Date", "Date"],
    description: ["PARTICULARS", "Particulars", "Description"],
    debit: ["DR", "Debit", "Debit Amount"],
    credit: ["CR", "Credit", "Credit Amount"],
    balance: ["BAL", "Balance"],
  },

  Kotak: {
    date: ["Transaction Date", "Date"],
    description: ["Description", "Particulars", "Narration"],
    debit: ["Debit", "DR", "Withdrawal"],
    credit: ["Credit", "CR", "Deposit"],
    balance: ["Balance"],
  },

  PNB: {
    date: ["Txn Date", "Date", "Transaction Date"],
    description: ["Particulars", "Description", "Narration"],
    debit: ["Debit", "DR Amount", "Withdrawal(Dr.)"],
    credit: ["Credit", "CR Amount", "Deposit(Cr.)"],
    balance: ["Balance"],
    skipRows: 0,
  },

  BankOfBaroda: {
    date: ["Tran Date", "Date", "Transaction Date"],
    description: ["Narration", "Particulars", "Description"],
    debit: ["Debit", "DR", "Withdrawal Amt"],
    credit: ["Credit", "CR", "Deposit Amt"],
    balance: ["Balance"],
  },

  Canara: {
    date: ["Date", "Transaction Date", "Tran Date"],
    description: ["Particulars", "Description", "Narration"],
    debit: ["Debit Amount", "Debit", "DR"],
    credit: ["Credit Amount", "Credit", "CR"],
    balance: ["Balance"],
  },

  IndusInd: {
    date: ["Transaction Date", "Date", "Value Date"],
    description: ["Description", "Particulars", "Narration"],
    debit: ["Debit", "DR Amount", "Withdrawal"],
    credit: ["Credit", "CR Amount", "Deposit"],
    balance: ["Running Balance", "Balance"],
  },

  YesBank: {
    date: ["Date", "Transaction Date", "Value Date"],
    description: ["Particulars", "Description", "Narration"],
    debit: ["Withdrawal Amt (INR)", "Debit", "DR"],
    credit: ["Deposit Amt (INR)", "Credit", "CR"],
    balance: ["Balance (INR)", "Balance"],
  },
}

/** Find the value of a column from a row using multiple possible header names */
export function resolveColumn(row: Record<string, string>, candidates: string | string[]): string {
  const keys = Array.isArray(candidates) ? candidates : [candidates]
  for (const key of keys) {
    // Exact match first
    if (row[key] !== undefined) return row[key]
    // Case-insensitive match
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.trim().toLowerCase())
    if (found !== undefined) return row[found]
  }
  return ""
}

/** Parse an amount string like "1,234.56" or "1234.56 Dr" into a number */
export function parseAmount(raw: string): number {
  if (!raw) return 0
  const cleaned = raw
    .replace(/[,\s]/g, "")  // remove commas and spaces
    .replace(/[DrCrDRCR]+$/i, "")  // remove Dr/Cr suffix
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.abs(num)
}

/** Parse various Indian date formats into YYYY-MM-DD */
export function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`

  // DD MMM YYYY (e.g. 15 Apr 2026)
  const dmmy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (dmmy) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    }
    const m = months[dmmy[2].toLowerCase()]
    if (m) return `${dmmy[3]}-${m}-${dmmy[1].padStart(2, "0")}`
  }

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Try native Date parse as fallback
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]

  return null
}
