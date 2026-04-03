"use client"

import useSWR from "swr"
import { supabase } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

async function fetchUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

/**
 * Returns the currently authenticated user, cached by SWR.
 * Use the returned `user.id` to scope other SWR keys so that
 * cached data from a previous session is never served to a
 * different user.
 */
export function useCurrentUser() {
  return useSWR<User | null>("current-user", fetchUser, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
  })
}
