import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Global middleware — runs on every request before page/route handlers.
 *
 * Responsibilities:
 *  1. Inject HTTP security headers on every response
 *  2. Enforce authentication on /dashboard (redirect to /login if unauthenticated)
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // ── 1. Security headers ────────────────────────────────────────────────────
  // Prevent clickjacking — no iframing of this app allowed
  response.headers.set("X-Frame-Options", "DENY")
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")
  // Legacy XSS filter (belt-and-suspenders alongside CSP)
  response.headers.set("X-XSS-Protection", "1; mode=block")
  // Leak minimal referrer info to third parties
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // Enforce HTTPS for 2 years, cascade to subdomains
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  )
  // Restrict sensitive browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  )

  // Content Security Policy
  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace("https://", "")
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Next.js runtime needs unsafe-inline + unsafe-eval in both dev and prod (Turbopack)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind injects styles at runtime
      "style-src 'self' 'unsafe-inline'",
      // Images: self, blob (file preview), data (base64 previews)
      "img-src 'self' blob: data:",
      "font-src 'self'",
      // Supabase REST + Realtime websocket connections
      `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
      // Disallow embedding in any frame (double-enforces X-Frame-Options)
      "frame-ancestors 'none'",
      // Prevent base-tag injection
      "base-uri 'self'",
      // Only submit forms to same origin
      "form-action 'self'",
    ].join("; "),
  )

  // ── 2. Auth guard for /dashboard ──────────────────────────────────────────
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) =>
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            ),
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  // Run on every route except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
