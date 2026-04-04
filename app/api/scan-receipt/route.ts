import { generateText } from "ai"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ReceiptScanSchema, ReceiptDataSchema } from "@/lib/schemas/expense-schema"
import { validateInput } from "@/lib/utils/validation-helpers"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { checkDbRateLimit } from "@/lib/utils/rate-limit-db"
import { toSafeMessage } from "@/lib/utils/safe-error"

// Maximum base64 payload: ~6 MB encoded ≈ 4.5 MB original file
const MAX_BASE64_BYTES = 6 * 1024 * 1024

// MIME types that are explicitly blocked (SVG can embed JS that executes on render)
const BLOCKED_MIME_PREFIXES = ["data:image/svg"]

export async function POST(request: Request) {
  try {
    // ── 0. Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // ── 1. Rate limiting — two layers ─────────────────────────────────────────
    // Layer A: In-memory IP check (fast, catches hammering before DB round-trip)
    const clientIp =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"

    if (!checkRateLimit(`receipt-ip-${clientIp}`, { maxRequests: 10, windowMs: 60 * 1000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before scanning another receipt." },
        { status: 429 },
      )
    }

    // Layer B: Per-user DB-backed check (survives serverless restarts; 20/hour)
    const dbLimit = await checkDbRateLimit(user.id, "scan-receipt", 20, 3600)
    if (!dbLimit.allowed) {
      const resetMins = Math.ceil((dbLimit.resetAt.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        {
          error: `Receipt scan limit reached. Resets in ${resetMins} minute${resetMins !== 1 ? "s" : ""}.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": dbLimit.resetAt.toISOString(),
          },
        },
      )
    }

    // ── 2. Parse + validate request body ─────────────────────────────────────
    const body = await request.json()
    const validationResult = validateInput(ReceiptScanSchema, body)

    if (validationResult.error || !validationResult.data) {
      return NextResponse.json(
        { error: validationResult.error ?? "Invalid request body" },
        { status: 400 },
      )
    }

    const { image } = validationResult.data

    // ── 3. Image safety checks ────────────────────────────────────────────────
    // Block SVG — can contain embedded <script> that executes when rendered
    if (BLOCKED_MIME_PREFIXES.some((prefix) => image.startsWith(prefix))) {
      return NextResponse.json(
        { error: "SVG images are not supported. Please upload a JPEG or PNG." },
        { status: 400 },
      )
    }

    // Reject oversized payloads to prevent memory exhaustion + API cost abuse
    const payloadBytes = Buffer.byteLength(image, "utf8")
    if (payloadBytes > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 4.5 MB." },
        { status: 413 },
      )
    }

    // ── 4. AI extraction ──────────────────────────────────────────────────────
    const { text } = await generateText({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a receipt analyzer. Extract expense information from receipts, bills, or handwritten notes.

Available categories:
- Investments
- EMIs
- Monthly Fixed Expenses
- Cab Expense
- Food Apps Expense
- Quick Order Apps Expense
- Shopping Apps Expense
- Travel Expenses
- Credit card bills

Respond with ONLY a JSON object in this exact format:
{
  "amount": number,
  "description": string,
  "category": string (from the list above),
  "date": string (YYYY-MM-DD format, use today if not found)
}

If you cannot extract information, respond with:
{
  "error": "Unable to extract expense information from image"
}`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the expense details from this image" },
            { type: "image", image: image },
          ],
        },
      ],
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse receipt" }, { status: 400 })
    }

    const rawResult = JSON.parse(jsonMatch[0])

    if (rawResult.error) {
      return NextResponse.json({ error: rawResult.error }, { status: 400 })
    }

    const dataValidationResult = validateInput(ReceiptDataSchema, rawResult)
    if (dataValidationResult.error || !dataValidationResult.data) {
      return NextResponse.json(
        { error: `Invalid extracted data: ${dataValidationResult.error ?? "unknown"}` },
        { status: 400 },
      )
    }

    return NextResponse.json(dataValidationResult.data)
  } catch (error) {
    console.error("[scan-receipt] Error:", error)
    return NextResponse.json({ error: toSafeMessage(error) }, { status: 500 })
  }
}
