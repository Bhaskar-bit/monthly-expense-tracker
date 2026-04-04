/**
 * safe-error.ts
 *
 * In production, raw error messages from Supabase or internal services can
 * leak table names, column names, query shapes, and stack traces.
 *
 * This module sanitises errors so only user-friendly messages reach the
 * client, while full details are retained in server-side console logs.
 */

/**
 * Error messages that are safe to surface verbatim to the end user.
 * These are application-level, not infrastructure-level, messages.
 */
const USER_SAFE_PATTERNS: RegExp[] = [
  /not authenticated/i,
  /unauthorized/i,
  /amount must/i,
  /too many requests/i,
  /invalid/i,
  /required/i,
  /not found/i,
  /already exists/i,
  /failed to parse/i,
  /unable to extract/i,
  /please (fill|wait|try)/i,
]

/**
 * Returns a safe error message string.
 * - In development: returns the full error message for easier debugging.
 * - In production: only whitelisted messages pass through; everything else
 *   becomes a generic fallback that doesn't expose internals.
 */
export function toSafeMessage(error: unknown): string {
  if (process.env.NODE_ENV !== "production") {
    if (error instanceof Error) return error.message
    return String(error)
  }

  if (error instanceof Error) {
    const msg = error.message
    if (USER_SAFE_PATTERNS.some((p) => p.test(msg))) return msg
  }

  return "An unexpected error occurred. Please try again."
}

/**
 * Convenience wrapper for API route error responses.
 * Returns `{ error: string, status: number }` ready to pass to NextResponse.json().
 */
export function toSafeApiError(
  error: unknown,
  defaultStatus = 500,
): { error: string; status: number } {
  return {
    error: toSafeMessage(error),
    status: defaultStatus,
  }
}
