import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function SavingsGoalsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Import the new client component
  const { default: SavingsGoalsPageV2 } = await import("./page-v2")

  return <SavingsGoalsPageV2 />
}
