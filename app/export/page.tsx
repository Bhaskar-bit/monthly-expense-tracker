"use client"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, FileText } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"

export default function ExportPage() {
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<any[]>([])
  const [selectedMonth, setSelectedMonth] = useState("")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadMonths() {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.getUser()

      if (error || !data?.user) {
        redirect("/auth/login")
      }

      const { data: monthsData } = await supabase
        .from("months")
        .select("month_year")
        .eq("user_id", data.user.id)
        .order("month_year", { ascending: false })

      setMonths(monthsData || [])
      if (monthsData && monthsData.length > 0) {
        setSelectedMonth(monthsData[0].month_year)
      }
      setLoading(false)
    }

    loadMonths()
  }, [])

  const handleExportCSV = async () => {
    if (!selectedMonth) return

    setExporting(true)
    const supabase = await createClient()
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) {
      setExporting(false)
      return
    }

    const { data: expenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.user.id)
      .gte("expense_date", selectedMonth)
      .lt(
        "expense_date",
        new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString(),
      )

    const csv = [
      ["Date", "Category", "Amount", "Description"],
      ...(expenses?.map((e) => [e.expense_date, e.category, e.amount, e.description || ""]) || []),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `expenses-${selectedMonth}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    setExporting(false)
  }

  const handleExportPDF = async () => {
    if (!selectedMonth) return

    setExporting(true)
    const supabase = await createClient()
    const { data: user } = await supabase.auth.getUser()

    if (!user?.user) {
      setExporting(false)
      return
    }

    const { data: monthData } = await supabase
      .from("months")
      .select("*")
      .eq("user_id", user.user.id)
      .eq("month_year", selectedMonth)
      .single()

    const { data: expenses } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.user.id)
      .gte("expense_date", selectedMonth)
      .lt(
        "expense_date",
        new Date(new Date(selectedMonth).getFullYear(), new Date(selectedMonth).getMonth() + 1, 0).toISOString(),
      )

    const monthName = new Date(selectedMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f5f5f5; }
            .summary { display: flex; gap: 20px; margin-top: 20px; }
            .summary-item { padding: 15px; border-radius: 5px; background-color: #f9f9f9; flex: 1; }
          </style>
        </head>
        <body>
          <h1>Expense Report - ${monthName}</h1>
          <div class="summary">
            <div class="summary-item">
              <strong>Total Income:</strong> ₹${monthData?.inflow || 0}
            </div>
            <div class="summary-item">
              <strong>Total Expenses:</strong> ₹${expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0}
            </div>
            <div class="summary-item">
              <strong>Remaining:</strong> ₹${Number(monthData?.inflow || 0) - (expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0)}
            </div>
          </div>
          <h2>Detailed Expenses</h2>
          <table>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Description</th>
            </tr>
            ${expenses?.map((e) => `<tr><td>${e.expense_date}</td><td>${e.category}</td><td>₹${e.amount}</td><td>${e.description || ""}</td></tr>`).join("") || ""}
          </table>
        </body>
      </html>
    `

    const printWindow = window.open("", "", "width=800,height=600")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }

    setExporting(false)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
                  <Download className="w-6 h-6" />
                  Export Reports
                </h1>
                <p className="text-sm text-muted-foreground">Download your expense data</p>
              </div>
            </div>
          </div>
        </div>
      </header>

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
                    {new Date(month.month_year).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
    </div>
  )
}
