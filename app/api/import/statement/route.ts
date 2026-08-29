/**
 * POST /api/import/statement
 *
 * Manual upload path. Accepts an ICICI e-statement PDF, parses it, classifies
 * every transaction, and stages the result in import_transactions for review.
 *
 * Nothing is written to `expenses` here. Staging only. Confirmation is a
 * separate, deliberate action — which is what makes it safe to run this
 * against a real statement without risking 17 months of data.
 *
 * Postmark will later call the same logic with the PDF taken from an email
 * attachment instead of a form upload. Only the first twenty lines differ.
 *
 * Nothing derived from the PDF — text, narration, or the password — is ever
 * logged. Failures are reported as fixed strings.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { extractWithCandidates, passwordCandidates, WrongPasswordError } from "@/lib/pdf-extract"
import { parseIciciStatement, verifyChain } from "@/lib/icici-statement-parser"
import { classify, shouldAutoConfirm, type Category, type Registry } from "@/lib/transaction-classifier"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

const REGISTRY: Registry = {
  // Fragments identifying the account holder's own accounts. INF-mode
  // transactions already classify as internal transfers; this catches the rest.
  ownAccounts: (process.env.STATEMENT_OWN_ACCOUNTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  incomePatterns: [/salary/i, /\bSAL\b/],
}

/**
 * GET /api/import/statement?sessionId=...
 *
 * Returns the rows staged by a previous POST, read straight out of
 * import_transactions. The review screen uses this rather than the POST
 * response, so what the user approves is what is actually on the table.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessionId = new URL(request.url).searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("import_transactions")
    .select(
      "id, raw_description, raw_amount, raw_date, raw_type, ai_category, ai_confidence, expense_source, is_duplicate, is_selected",
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("raw_date", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Could not load staged transactions" }, { status: 500 })
  }

  return NextResponse.json({ transactions: data ?? [], total: data?.length ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = user.id

  // --- input ------------------------------------------------------------
  const form = await request.formData()
  const file = form.get("file")
  const passwordField = form.get("password")
  const password =
    typeof passwordField === "string" && passwordField.length > 0 ? passwordField : undefined

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file supplied" }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File larger than 10MB" }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // --- extract ----------------------------------------------------------
  let text: string
  try {
    const candidates = password
      ? [password]
      : passwordCandidates(process.env.STATEMENT_NAME_PREFIX ?? "", process.env.STATEMENT_DOB ?? "")
    // An unencrypted statement needs no password at all, so try that first.
    text = await extractWithCandidates(bytes, ["", ...candidates])
  } catch (err) {
    if (err instanceof WrongPasswordError) {
      return NextResponse.json(
        { error: "Password rejected — check the statement password and try again" },
        { status: 422 },
      )
    }
    // The exception's class name only. It names the failure mode
    // (InvalidPDFException, DataCloneError, ...) without carrying statement
    // text, narration or the password into the logs. Swallowing it entirely
    // once cost a full debugging round-trip.
    const name = err instanceof Error ? err.name : "UnknownError"
    // The message too, server-side only. pdfjs messages describe the failure
    // mode ("Setting up fake worker failed", "Invalid PDF structure") and never
    // carry document text, so this stays within the no-statement-data rule —
    // and `name` alone came back as a useless bare "Error".
    const detail = err instanceof Error ? err.message : ""
    console.error("[import/statement] extraction failed:", name, "|", detail.slice(0, 200))
    return NextResponse.json(
      { error: `Could not read the PDF (${name})` },
      { status: 422 },
    )
  }

  // --- parse ------------------------------------------------------------
  const parsed = parseIciciStatement(text)

  const wantsDiagnostics = form.get("diagnose") === "1"
  const extractedLines = wantsDiagnostics
    ? text.split("\n").map((l) => l.trim()).filter(Boolean)
    : []

  if (parsed.transactions.length === 0) {
    return NextResponse.json(
      { error: "No transactions found — the layout may have changed", warnings: parsed.warnings },
      { status: 422 },
    )
  }

  // Closing balance printed on the statement, if present, verifies nothing was
  // dropped. Absent a C/F row, fall back to the printed statement summary.
  const cfRow =
    text.match(/\bC\/F\b[^\d]*([\d,]+\.\d{2})/) ??
    text.match(/closing\s+balance[^\d-]*([\d,]+\.\d{2})/i)

  // This statement format prints no C/F row — its closing figure lives on the
  // "Total:" row instead, which the parser now reads.
  const printedClosing = cfRow
    ? parseFloat(cfRow[1].replace(/,/g, ""))
    : parsed.printedClosingBalance

  const integrity = printedClosing !== null
    ? verifyChain(parsed, printedClosing)
    : {
        ok: true,
        discrepancy: 0,
        message:
          "No C/F row or printed closing balance found — the chain end is not independently verified.",
      }

  // --- learned mappings -------------------------------------------------
  const { data: training } = await supabase
    .from("category_training_data")
    .select("description, category")
    .eq("user_id", userId)
    .eq("is_validated", true)

  const learned = new Map<string, Category>(
    ((training ?? []) as Array<{ description: string | null; category: string }>)
      .filter((t) => !!t.description)
      .map((t) => [t.description!.trim().toLowerCase(), t.category as Category] as const),
  )

  // --- existing rows, for duplicate detection ---------------------------
  const dates = parsed.transactions.map((t) => t.date).sort()
  const { data: existing } = await supabase
    .from("expenses")
    .select("expense_date, amount, description")
    .eq("user_id", userId)
    .gte("expense_date", dates[0])
    .lte("expense_date", dates[dates.length - 1])

  const existingKeys = new Set(
    ((existing ?? []) as Array<{ expense_date: string; amount: number }>).map(
      (e) => `${e.expense_date}|${Number(e.amount).toFixed(2)}`,
    ),
  )

  // --- recurring expenses, which this app already logs by itself ---------
  //
  // EMIs and fixed expenses are created automatically each month from
  // recurring_expenses, so importing them from the statement double-counts
  // them. The exact-date check above misses these routinely: the auto-created
  // entry is dated from the rule's day_of_month, while the statement carries
  // the bank's posting date, and those differ whenever the scheduled day lands
  // on a weekend or the bank posts late. Matching on amount instead of date
  // survives that drift.
  const { data: recurring } = await supabase
    .from("recurring_expenses")
    .select("amount, description, category, day_of_month")
    .eq("user_id", userId)
    .eq("is_active", true)

  const recurringAmounts = new Map<string, { description: string | null; category: string }>(
    ((recurring ?? []) as Array<{ amount: number; description: string | null; category: string }>).map(
      (r) => [Number(r.amount).toFixed(2), { description: r.description, category: r.category }] as const,
    ),
  )

  // --- session ----------------------------------------------------------
  const { data: session, error: sessErr } = await supabase
    .from("import_sessions")
    .insert({
      user_id: userId,
      source_type: "pdf",
      source_bank: "ICICI",
      status: "pending",
      raw_count: parsed.transactions.length,
    })
    .select("id")
    .single()

  if (sessErr || !session) {
    return NextResponse.json({ error: "Could not create import session" }, { status: 500 })
  }

  // --- classify and stage ----------------------------------------------
  let autoConfirmable = 0
  let needsReview = 0

  const classifications = parsed.transactions.map((txn) => classify(txn, REGISTRY, learned))

  const recurringMatches: number[] = []

  const rows = parsed.transactions.map((txn, i) => {
    const c = classifications[i]
    const amountKey = txn.amount.toFixed(2)
    const dupKey = `${txn.date}|${amountKey}`

    // A debit whose amount equals an active recurring rule is almost certainly
    // the charge this app already logged for you. Credits are excluded: a
    // refund that happens to equal an EMI is not that EMI.
    const recurringMatch =
      txn.direction === "debit" ? (recurringAmounts.get(amountKey) ?? null) : null
    if (recurringMatch) recurringMatches.push(i)

    const isDuplicate = existingKeys.has(dupKey) || !!recurringMatch
    const auto = shouldAutoConfirm(txn, c) && integrity.ok && !isDuplicate

    if (auto) autoConfirmable++
    else needsReview++

    return {
      session_id: session.id as string,
      user_id: userId,
      raw_description: txn.merchant ?? txn.narration.slice(0, 200),
      raw_amount: txn.amount,
      raw_date: txn.date,
      raw_type: txn.direction,
      ai_category: c.category,
      ai_confidence: c.confidence,
      expense_source: "savings_account",
      is_duplicate: isDuplicate,
      // Transfers and income are deselected by default: they are not spending,
      // and silently importing them as expenses is exactly how a savings rate
      // becomes fiction.
      is_selected: auto && c.kind === "EXPENSE",
    }
  })

  const { error: insErr } = await supabase.from("import_transactions").insert(rows)
  if (insErr) {
    await supabase.from("import_sessions").update({ status: "cancelled" }).eq("id", session.id)
    return NextResponse.json({ error: "Could not stage transactions" }, { status: 500 })
  }

  return NextResponse.json({
    sessionId: session.id,
    parsed: parsed.transactions.length,
    autoConfirmable,
    needsReview,
    // Recurring matches also set is_duplicate, so count only the rows that
    // matched an existing expense outright — otherwise the same rows are
    // reported twice, once under each heading.
    duplicates: rows.filter((r, i) => r.is_duplicate && !recurringMatches.includes(i)).length,
    openingBalance: parsed.openingBalance,
    closingBalance: parsed.closingBalance,
    integrity,
    warnings: parsed.warnings,
    // `kind` is not a column on import_transactions, so it comes back here for
    // the review screen to label rows with. Selection state is already staged.
    kinds: classifications.map((c) => c.kind),
    modes: parsed.transactions.map((t) => t.mode),
    // Opt-in only, and returned solely to the authenticated owner of the
    // statement — never logged. Diagnosing a layout mismatch without ever
    // seeing a line of the real text turned into several wrong guesses; this
    // is the smallest window that avoids repeating that.
    diagnostics: wantsDiagnostics
      ? {
          totalLines: extractedLines.length,
          head: extractedLines.slice(0, 8),
          tail: extractedLines.slice(-8),
          totalsRows: extractedLines.filter((l) => /^\s*Total\s*:/i.test(l)).slice(-3),
          bfRows: extractedLines.filter((l) => /\bB\/F\b/.test(l)).slice(0, 3),
        }
      : undefined,
    // Indices of rows matching an active recurring rule, so the review screen
    // can say why they are unticked rather than leaving it a mystery.
    recurringMatches,
    recurring: recurringMatches.length,
  })
}
