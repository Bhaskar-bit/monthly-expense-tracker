import { fileURLToPath } from "url"
import path from "path"
import withPWAInit from "@ducanh2912/next-pwa"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Disable service worker in dev to avoid caching issues during development
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // pdfjs-dist ships ESM with dynamic requires the bundler mangles. Leaving it
  // external means the Node runtime loads it as published, which is the only
  // way the legacy build works on Vercel.
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    root: __dirname,
  },
  // Defence-in-depth: security headers applied at the CDN / edge cache layer.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)
