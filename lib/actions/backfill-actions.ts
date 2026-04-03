"use server"

import { createClient } from "@/lib/supabase/server"
import { goalContributionService } from "@/lib/services/goal-contribution-service"
import { revalidateTag } from "next/cache"

export async function backfillHistoricalInvestmentsAction() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    const result = await goalContributionService.backfillHistoricalInvestmentsByPriority(
      userData.user.id,
      supabase,
    )

    // Revalidate savings goals cache so UI updates
    revalidateTag("savings-goals")

    return {
      success: true,
      message: `Successfully synced ${result.synced} investments to savings goals with priority-based allocation. ${result.skipped} were already synced.`,
      synced: result.synced,
      skipped: result.skipped,
    }
  } catch (error) {
    console.error("[v0] Error in backfillHistoricalInvestmentsAction:", error)
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
      synced: 0,
      skipped: 0,
    }
  }
}
