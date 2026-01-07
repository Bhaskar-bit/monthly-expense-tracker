import { recurringExpenseProcessor } from "@/lib/services/recurring-expense-processor"

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const result = await recurringExpenseProcessor.processRecurringExpenses()

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[v0] Cron job error:", error)
    return new Response(JSON.stringify({ error: "Failed to process recurring expenses" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
