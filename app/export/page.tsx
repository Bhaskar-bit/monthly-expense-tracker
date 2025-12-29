"use client"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download } from "lucide-react"
import Link from "next/link"
import { ExportClientContent } from "@/components/export-client-content"

export default async function ExportPage() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData?.user) {
    redirect("/auth/login")
  }

  const { data: monthsData } = await supabase
    .from("months")
    .select("month_year")
    .eq("user_id", authData.user.id)
    .order("month_year", { ascending: false })

  const months = monthsData || []

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

      <ExportClientContent months={months} />
    </div>
  )
}
