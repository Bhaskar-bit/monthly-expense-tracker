import { generateText } from "ai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Use AI SDK with vision model to analyze the receipt
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

    // Parse the AI response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse receipt" }, { status: 400 })
    }

    const result = JSON.parse(jsonMatch[0])

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[v0] Receipt scanning error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan receipt" },
      { status: 500 },
    )
  }
}
