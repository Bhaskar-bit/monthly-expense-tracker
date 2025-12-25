import { NextResponse } from "next/server"
import { Base64ImageSchema } from "@/lib/schemas/file-schema"
import { validateInput } from "@/lib/utils/validation-helpers"
import { checkRateLimit } from "@/lib/utils/rate-limit"

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || "unknown"
    const rateLimitKey = `image-optimize-${clientIp}`

    if (!checkRateLimit(rateLimitKey, { maxRequests: 10, windowMs: 60 * 1000 })) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const { image } = await request.json()

    const validationResult = validateInput(Base64ImageSchema, image)
    if (validationResult.error) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 })
    }

    // For server-side image optimization, use a library like sharp
    // For now, we'll keep the image as-is since it's already base64
    // In production, you'd use sharp to reduce file size

    // Return the base64 image (in production, optimize with sharp)
    return NextResponse.json({
      optimized_image: validationResult.data,
      size_reduction: "Client-side compression recommended",
    })
  } catch (error) {
    console.error("[v0] Image optimization error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to optimize image" },
      { status: 500 },
    )
  }
}
