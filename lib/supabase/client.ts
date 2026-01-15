import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let supabaseInstance: SupabaseClient | null = null

export function createClient() {
  // Return existing instance if already created
  if (supabaseInstance) {
    return supabaseInstance
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error(
      "[v0] Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.",
    )
    throw new Error("Supabase environment variables are not configured. Please check your environment setup.")
  }

  // Create and cache the client instance
  supabaseInstance = createBrowserClient(url, key)
  return supabaseInstance
}

// Export singleton instance directly for use in hooks
export const supabase = createClient()
