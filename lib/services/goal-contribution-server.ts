import { createClient } from "@/lib/supabase/server"
import type { GoalContribution } from "@/lib/types"

interface DistributeInvestmentInput {
  expense_id: string
  amount: number
  contribution_date: string
  user_id: string
}

export const goalContributionServerService = {
  async distributeInvestmentToGoals(input: DistributeInvestmentInput): Promise<GoalContribution[]> {
    const supabase = await createClient()

    // Fetch all active savings goals for the user
    const { data: goals, error: goalsError } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", input.user_id)
      .eq("status", "active")

    if (goalsError) {
      console.error("[v0] Error fetching goals:", goalsError)
      throw goalsError
    }

    if (!goals || goals.length === 0) {
      console.log("[v0] No active goals found for investment distribution")
      return []
    }

    // Calculate amount per goal (distribute equally)
    const amountPerGoal = input.amount / goals.length
    console.log(
      `[v0] Distributing ₹${input.amount} equally among ${goals.length} goals (₹${amountPerGoal.toFixed(2)} each)`,
    )

    // Create goal contribution records for each goal
    const contributions: GoalContribution[] = []

    for (const goal of goals) {
      try {
        const { data: contribution, error } = await supabase
          .from("goal_contributions")
          .insert({
            user_id: input.user_id,
            goal_id: goal.id,
            expense_id: input.expense_id,
            amount: amountPerGoal,
            contribution_date: input.contribution_date,
          })
          .select()
          .single()

        if (error) {
          console.error(`[v0] Failed to create contribution for goal ${goal.id}:`, error)
          continue
        }

        contributions.push(contribution)

        // Update goal's current_amount
        const newAmount = (goal.current_amount || 0) + amountPerGoal
        const { error: updateError } = await supabase
          .from("savings_goals")
          .update({ current_amount: newAmount })
          .eq("id", goal.id)
          .eq("user_id", input.user_id)

        if (updateError) {
          console.error(`[v0] Failed to update goal ${goal.id} current_amount:`, updateError)
        } else {
          console.log(`[v0] Updated goal ${goal.id} current_amount from ₹${goal.current_amount || 0} to ₹${newAmount}`)
        }
      } catch (err) {
        console.error(`[v0] Exception processing goal ${goal.id}:`, err)
      }
    }

    console.log(`[v0] Successfully distributed ₹${input.amount} to ${contributions.length} of ${goals.length} goals`)
    return contributions
  },
}
