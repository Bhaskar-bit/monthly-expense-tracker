import { recurringExpenseProcessor } from "@/lib/services/recurring-expense-processor"

export async function GET(request: Request) {
  try {
    // Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` for
    // cron invocations when CRON_SECRET is set in your project env vars.
    // Requiring it unconditionally prevents the endpoint from being triggered
    // by unauthenticated external requests.
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("CRON_SECRET env var is not set — cron endpoint is unprotected")
      return new Response("Service Unavailable: CRON_SECRET not configured", { status: 503 })
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const result = await recurringExpenseProcessor.processRecurringExpensesDaily()

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Cron job error:", error)
    return new Response(JSON.stringify({ error: "Failed to process recurring expenses" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
