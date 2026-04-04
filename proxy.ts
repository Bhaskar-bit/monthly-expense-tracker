import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Global proxy — runs on every request before page/route handlers.
 *
 * Responsibilities:
 *  1. Refresh Supabase session cookies (keep JWT alive)
 *  2. Inject HTTP security headers on every response
 *  3. Enforce authentication on /dashboard and /settings
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.next({ request })
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  // ── Auth guard for protected routes ──────────────────────────────────────
  if (
    error ||
    !user
  ) {
    if (
      request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/settings")
    ) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Security headers on every response ───────────────────────────────────
  // Prevent clickjacking
  supabaseResponse.headers.set("X-Frame-Options", "DENY")
  // Prevent MIME-type sniffing
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff")
  // Legacy XSS filter (belt-and-suspenders alongside CSP)
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block")
  // Leak minimal referrer info to third parties
  supabaseResponse.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // Enforce HTTPS for 2 years, cascade to subdomains
  supabaseResponse.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  )
  // Restrict sensitive browser features
  supabaseResponse.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  )

  // Content Security Policy
  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace("https://", "")
  supabaseResponse.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  )

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
