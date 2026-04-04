/**
 * rate-limit-db.ts
 *
 * Supabase-backed rate limiter that works correctly across serverless function
 * instances. Unlike the in-memory Map approach (lib/utils/rate-limit.ts), this
 * persists counters in Postgres so all instances share the same window state.
 *
 * Uses the `increment_rate_limit` SECURITY DEFINER function applied in the
 * security_hardening migration, which atomically increments a counter and
 * cleans up expired windows.
 */

import { createClient } from "@/lib/supabase/server"

export interface DbRateLimitResult {
  /** Whether the request is within the allowed limit */
  allowed: boolean
  /** Requests remaining in the current window */
  remaining: number
  /** When the current window resets */
  resetAt: Date
}

/**
 * Check and increment a rate limit counter backed by Supabase.
 *
 * @param userId      - The authenticated user's ID (scopes the counter per user)
 * @param action      - Identifier for the action being rate-limited (e.g. 'scan-receipt')
 * @param maxRequests - Maximum number of requests allowed per window
 * @param windowSecs  - Duration of the sliding window in seconds
 *
 * Fails open: if the database call errors, the request is allowed through
 * (avoids blocking legitimate users due to transient DB issues).
 */
export async function checkDbRateLimit(
  userId: string,
  action: string,
  maxRequests: number,
  windowSecs: number,
): Promise<DbRateLimitResult> {
  const fallback: DbRateLimitResult = {
    allowed: true,
    remaining: maxRequests,
    resetAt: new Date(Date.now() + windowSecs * 1000),
  }

  try {
    const supabase = await createClient()
    const key = `${action}:${userId}`

    const { data, error } = await supabase.rpc("increment_rate_limit", {
      p_key: key,
      p_window_seconds: windowSecs,
      p_max: maxRequests,
    })

    if (error || !data) {
      console.error("[RateLimitDB] RPC error, failing open:", error?.message)
      return fallback
    }

    const count: number = data.count
    const resetAt = new Date(data.window_end)

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    }
  } catch (err) {
    console.error("[RateLimitDB] Unexpected error, failing open:", err)
    return fallback
  }
}
