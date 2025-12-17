import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { YearlySummaryClient } from "@/components/yearly-summary-client"
import { Button } from "@/components/ui/button"
import { LogOut, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function YearlySummaryPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Yearly Summary</h1>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server"
              const supabase = await createClient()
              await supabase.auth.signOut()
              redirect("/auth/login")
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <YearlySummaryClient />
      </main>
    </div>
  )
}
