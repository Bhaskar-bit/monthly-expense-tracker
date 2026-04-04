"use client"

import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, ArrowRight,
  ArrowLeft, Loader2, Download
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ImportBank } from "@/lib/types"
import { mutate } from "swr"
import { useCurrentUser } from "@/lib/hooks/use-current-user"
import { useMonth } from "@/lib/context/month-context"
import type { RawTransaction } from "@/app/api/import/parse/route"
import type { CategorizedTransaction } from "@/app/api/import/categorize/route"

type Step = "upload" | "review" | "done"

interface ReviewRow extends CategorizedTransaction {
  id: string
  finalCategory: ExpenseCategory | ""
  finalDescription: string
  expenseSource: "savings_account" | "credit_card"
  selected: boolean
}

const BANKS: { value: ImportBank; label: string }[] = [
  { value: "HDFC",        label: "HDFC Bank" },
  { value: "ICICI",       label: "ICICI Bank" },
  { value: "SBI",         label: "State Bank of India (SBI)" },
  { value: "Axis",        label: "Axis Bank" },
  { value: "Kotak",       label: "Kotak Mahindra Bank" },
  { value: "PNB",         label: "Punjab National Bank (PNB)" },
  { value: "BankOfBaroda",label: "Bank of Baroda" },
  { value: "Canara",      label: "Canara Bank" },
  { value: "IndusInd",    label: "IndusInd Bank" },
  { value: "YesBank",     label: "Yes Bank" },
  { value: "Generic",     label: "Other / Auto-detect" },
]

const CONFIDENCE_BADGE = (c: number) => {
  if (c >= 0.8) return <Badge className="bg-green-100 text-green-800 text-xs">High</Badge>
  if (c >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Medium</Badge>
  return <Badge className="bg-red-100 text-red-800 text-xs">Low</Badge>
}

export function ImportWizard() {
  const { toast } = useToast()
  const { data: user } = useCurrentUser()
  const { currentMonth } = useMonth()

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("upload")

  // Upload step state
  const [file, setFile] = useState<File | null>(null)
  const [bank, setBank] = useState<ImportBank>("Generic")
  const [isParsing, setIsParsing] = useState(false)

  // Review step state
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [isCategorizing, setIsCategorizing] = useState(false)

  // Done step state
  const [importResult, setImportResult] = useState<{ created: number; failed: number } | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  function reset() {
    setStep("upload")
    setFile(null)
    setBank("Generic")
    setRows([])
    setImportResult(null)
  }

  // ── Step 1: Upload & Parse ──────────────────────────────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setFile(f)
    e.target.value = ""
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  function getSourceType(f: File): "csv" | "xlsx" | "pdf" {
    const name = f.name.toLowerCase()
    if (name.endsWith(".csv")) return "csv"
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx"
    if (name.endsWith(".pdf")) return "pdf"
    return "csv"
  }

  async function handleParse() {
    if (!file) return
    setIsParsing(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const res = await fetch("/api/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, sourceType: getSourceType(file), bank }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Parse failed")
      if (!data.transactions?.length) {
        toast({ title: "No transactions found", description: "Check that you selected the right file and bank", variant: "destructive" })
        return
      }

      // Move to review, then trigger AI categorization in background
      setStep("review")
      setRows(
        (data.transactions as RawTransaction[]).map((t, i) => ({
          ...t,
          id: `${i}`,
          ai_category: null,
          ai_confidence: 0,
          finalCategory: "",
          finalDescription: t.raw_description,
          expenseSource: "savings_account",
          selected: true,
          is_duplicate: false,
        }))
      )

      setIsCategorizing(true)
      const catRes = await fetch("/api/import/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: data.transactions }),
      })
      const catData = await catRes.json()
      if (catRes.ok && catData.transactions) {
        setRows((prev) =>
          prev.map((row, i) => {
            const cat = catData.transactions[i] as CategorizedTransaction
            return {
              ...row,
              ai_category: cat?.ai_category ?? null,
              ai_confidence: cat?.ai_confidence ?? 0,
              finalCategory: (cat?.ai_category as ExpenseCategory) ?? "",
            }
          })
        )
      }
    } catch (err) {
      toast({ title: "Parse error", description: err instanceof Error ? err.message : "Failed to parse file", variant: "destructive" })
    } finally {
      setIsParsing(false)
      setIsCategorizing(false)
    }
  }

  // ── Step 2: Review ──────────────────────────────────────────────────────────

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })))
  }

  const selectedRows = rows.filter((r) => r.selected && r.finalCategory)
  const uncategorized = rows.filter((r) => r.selected && !r.finalCategory)

  async function handleConfirm() {
    if (selectedRows.length === 0) return
    setIsConfirming(true)
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: selectedRows.map((r) => ({
            raw_description: r.raw_description,
            raw_amount: r.raw_amount,
            raw_date: r.raw_date,
            category: r.finalCategory,
            description: r.finalDescription,
            expense_source: r.expenseSource,
          })),
          bank,
          sourceType: file ? getSourceType(file) : "csv",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")

      setImportResult({ created: data.created, failed: data.failed })
      setStep("done")

      // Refresh dashboard data
      mutate(`all-expenses-${user?.id}-${currentMonth}`)
      mutate(`expenses-${user?.id}-${currentMonth}-p1`)
      mutate(`month-${user?.id}-${currentMonth}`)
    } catch (err) {
      toast({ title: "Import error", description: err instanceof Error ? err.message : "Failed to import", variant: "destructive" })
    } finally {
      setIsConfirming(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(o: boolean) => { setOpen(o); if (!o) reset() }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-4 h-4" />
          Import Statement
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className={`flex flex-col gap-0 p-0 ${step === "review" ? "sm:max-w-4xl w-full" : "sm:max-w-lg"}`}
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Import Bank Statement
          </SheetTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-1">
            {(["upload", "review", "done"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${step === s ? "bg-primary" : i < ["upload","review","done"].indexOf(step) ? "bg-green-500" : "bg-muted"}`} />
                <span className={`text-xs capitalize ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
                {i < 2 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </SheetHeader>

        {/* ── Step 1: Upload ── */}
        {step === "upload" && (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {/* Bank selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your Bank</label>
              <Select value={bank} onValueChange={(v) => setBank(v as ImportBank)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BANKS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Selecting your bank helps parse columns correctly</p>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              {file ? (
                <div className="space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null) }}>
                    <X className="w-3.5 h-3.5 mr-1" />Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">Drop your bank statement here</p>
                  <p className="text-xs text-muted-foreground">CSV · XLSX · PDF (max 10 MB)</p>
                </div>
              )}
              <input id="import-file-input" type="file" className="hidden" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileSelect} />
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How to export:</p>
              <p>• <strong>HDFC/ICICI/SBI</strong>: Net banking → Statements → Download CSV</p>
              <p>• <strong>Axis/Kotak</strong>: Mobile app → Account → Statement → Export</p>
              <p>• Only debit (expense) transactions are imported</p>
            </div>

            <Button className="w-full" disabled={!file || isParsing} onClick={handleParse}>
              {isParsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsing…</> : "Parse & Continue"}
              {!isParsing && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Summary bar */}
            <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium">{rows.length} transactions</span>
                {isCategorizing && <span className="text-muted-foreground flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />AI categorizing…</span>}
                {uncategorized.length > 0 && !isCategorizing && (
                  <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{uncategorized.length} need category</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setStep("upload"); setRows([]) }}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back
                </Button>
                <Button
                  size="sm"
                  disabled={selectedRows.length === 0 || isConfirming}
                  onClick={handleConfirm}
                >
                  {isConfirming ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                  Import {selectedRows.length} expenses
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center">
                      <Checkbox
                        checked={rows.every((r) => r.selected)}
                        onCheckedChange={(c: boolean | "indeterminate") => toggleAll(!!c)}
                      />
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={`border-t ${!row.selected ? "opacity-40" : ""}`}>
                      <td className="px-3 py-1.5 text-center">
                        <Checkbox checked={row.selected} onCheckedChange={(c) => updateRow(row.id, { selected: !!c })} />
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{row.raw_date}</td>
                      <td className="px-3 py-1.5 max-w-xs">
                        <Input
                          value={row.finalDescription}
                          onChange={(e) => updateRow(row.id, { finalDescription: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium whitespace-nowrap">
                        ₹{row.raw_amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-1.5 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={row.finalCategory || "_none"}
                            onValueChange={(v) => updateRow(row.id, { finalCategory: v === "_none" ? "" : v as ExpenseCategory })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Select category —</SelectItem>
                              {EXPENSE_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.ai_confidence > 0 && CONFIDENCE_BADGE(row.ai_confidence)}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 min-w-[140px]">
                        <Select
                          value={row.expenseSource}
                          onValueChange={(v) => updateRow(row.id, { expenseSource: v as "savings_account" | "credit_card" })}
                        >
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="savings_account">Savings Account</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === "done" && importResult && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center space-y-5">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <div className="space-y-1">
              <h3 className="text-xl font-bold">{importResult.created} expenses imported!</h3>
              {importResult.failed > 0 && (
                <p className="text-sm text-muted-foreground">{importResult.failed} transactions failed</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Your dashboard has been updated with the imported transactions.</p>
            <div className="flex gap-3">
              <Button onClick={() => { reset(); setOpen(false) }}>Go to Dashboard</Button>
              <Button variant="outline" onClick={reset}>Import Another</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
