"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ExportClientContentProps {
  months: Array<{ month_year: string }>
}

export function ExportClientContent({ months }: ExportClientContentProps) {
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.month_year || "")
  const [exporting, setExporting] = useState(false)

  const handleExportCSV = async () => {
    if (!selectedMonth) return

    setExporting(true)
    try {
      const response = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `expenses-${selectedMonth}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("[v0] CSV export error:", error)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    if (!selectedMonth) return

    setExporting(true)
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `expenses-${selectedMonth}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("[v0] PDF export error:", error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <Card className="shadow-lg border-0 mb-8">
        <CardHeader>
          <CardTitle>Select Month to Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Choose a month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full mt-2 p-2 border rounded-lg bg-background"
            >
              {months.map((month) => (
                <option key={month.month_year} value={month.month_year}>
                  {new Date(month.month_year).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export as CSV
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Download as spreadsheet (Excel, Sheets)</p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportCSV} disabled={!selectedMonth || exporting} className="w-full" size="lg">
              {exporting ? "Exporting..." : "Download CSV"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Perfect for detailed analysis and archiving in your spreadsheet application.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export as PDF
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Download as formatted document</p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportPDF} disabled={!selectedMonth || exporting} className="w-full" size="lg">
              {exporting ? "Exporting..." : "Download PDF"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Perfect for sharing with accountants, banks, or keeping as official records.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 mt-8 bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/10">
        <CardHeader>
          <CardTitle className="text-primary">Export Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>
                CSV files are ideal for data analysis and can be opened in Excel, Google Sheets, or any spreadsheet
                application.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>PDF exports are great for record-keeping and sharing with professionals like accountants.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Keep regular backups of your expense data for financial planning and tax purposes.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
