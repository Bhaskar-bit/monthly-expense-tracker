import { generateText } from "ai"
import { NextResponse } from "next/server"
import { ReceiptScanSchema, ReceiptDataSchema } from "@/lib/schemas/expense-schema"
import { validateInput } from "@/lib/utils/validation-helpers"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { auditService } from "@/lib/services/audit-service"

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const rateLimitKey = `receipt-scan-${clientIp}`

    if (!checkRateLimit(rateLimitKey, { maxRequests: 5, windowMs: 60 * 1000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before scanning another receipt." },
        { status: 429 },
      )
    }

    const body = await request.json()
    const validationResult = validateInput(ReceiptScanSchema, body)

    if (validationResult.error) {
      return NextResponse.json({ error: validationResult.error }, { status: 400 })
    }

    const { image } = validationResult.data

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

    console.log("[v0] AI Receipt analysis response:", text)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse receipt" }, { status: 400 })
    }

    const rawResult = JSON.parse(jsonMatch[0])

    if (rawResult.error) {
      return NextResponse.json({ error: rawResult.error }, { status: 400 })
    }

    const dataValidationResult = validateInput(ReceiptDataSchema, rawResult)
    if (dataValidationResult.error) {
      return NextResponse.json({ error: `Invalid extracted data: ${dataValidationResult.error}` }, { status: 400 })
    }

    try {
      await auditService.logAction(
        {
          entity_type: "expense",
          entity_id: "receipt-scan-pending",
          action: "create",
          new_values: {
            source: "receipt_scan",
            extracted_data: dataValidationResult.data,
          },
        },
        clientIp,
        request.headers.get("user-agent") || undefined,
      )
    } catch (auditError) {
      console.error("[v0] Failed to log audit entry:", auditError)
    }

    return NextResponse.json(dataValidationResult.data)
  } catch (error) {
    console.error("[v0] Receipt scanning error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan receipt" },
      { status: 500 },
    )
  }
}
