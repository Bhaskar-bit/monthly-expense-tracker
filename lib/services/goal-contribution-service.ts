import { createClient } from "@/lib/supabase/client"
import type { GoalContribution } from "@/lib/types"

interface DistributeInvestmentInput {
  expense_id: string
  amount: number
  contribution_date: string
}

export const goalContributionService = {
  async getGoalContributionsByExpense(expenseId: string): Promise<GoalContribution[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("goal_contributions")
      .select("*")
      .eq("expense_id", expenseId)
      .eq("user_id", userData.user.id)

    if (error) throw error
    return data || []
  },

  async getGoalContributionsByGoal(goalId: string): Promise<GoalContribution[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("goal_contributions")
      .select("*")
      .eq("goal_id", goalId)
      .eq("user_id", userData.user.id)
      .order("contribution_date", { ascending: false })

    if (error) throw error
    return data || []
  },

  async deleteContribution(contributionId: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    // Get the contribution to retrieve goal_id and amount
    const { data: contribution } = await supabase
      .from("goal_contributions")
      .select("goal_id, amount, user_id")
      .eq("id", contributionId)
      .single()

    if (contribution?.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    // Delete the contribution
    const { error: deleteError } = await supabase.from("goal_contributions").delete().eq("id", contributionId)

    if (deleteError) throw deleteError

    // Revert the goal's current_amount
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("current_amount")
      .eq("id", contribution.goal_id)
      .single()

    if (goal) {
      const newAmount = Math.max(0, (goal.current_amount || 0) - contribution.amount)
      await supabase.from("savings_goals").update({ current_amount: newAmount }).eq("id", contribution.goal_id)
    }
  },

  async syncInvestmentExpenseToGoals(
    userId: string,
    expenseId: string,
    amount: number,
    expenseDate: string,
    category: string,
  ): Promise<void> {
    // Only sync Investment category expenses
    if (category !== "Investment") {
      return
    }

    try {
      const supabase = createClient()

      // Find all active savings goals
      const { data: goals, error: goalsError } = await supabase
        .from("savings_goals")
        .select("id, current_amount, target_amount")
        .eq("user_id", userId)
        .eq("status", "active")

      if (goalsError) {
        console.error("[v0] Error fetching savings goals:", goalsError)
        return
      }

      if (!goals || goals.length === 0) {
        console.log("[v0] No active savings goals found for investment contribution sync")
        return
      }

      // For each active goal, create a contribution record
      for (const goal of goals) {
        // Check if contribution already exists
        const { data: existingContribution, error: checkError } = await supabase
          .from("goal_contributions")
          .select("id")
          .eq("expense_id", expenseId)
          .eq("goal_id", goal.id)
          .maybeSingle()

        if (checkError) {
          console.error(`[v0] Error checking contribution for goal ${goal.id}:`, checkError)
          continue
        }

        // Only create if it doesn't already exist
        if (!existingContribution) {
          const { error: insertError } = await supabase.from("goal_contributions").insert({
            goal_id: goal.id,
            user_id: userId,
            expense_id: expenseId,
            amount,
            contribution_date: expenseDate,
          })

          if (insertError) {
            console.error(`[v0] Error creating contribution for goal ${goal.id}:`, insertError)
            continue
          }

          // Update goal's current_amount and check if completed
          const newCurrentAmount = Number(goal.current_amount || 0) + amount
          const newStatus = newCurrentAmount >= Number(goal.target_amount) ? "completed" : "active"

          const { error: updateError } = await supabase
            .from("savings_goals")
            .update({
              current_amount: newCurrentAmount,
              status: newStatus,
            })
            .eq("id", goal.id)

          if (updateError) {
            console.error(`[v0] Error updating goal ${goal.id}:`, updateError)
          } else {
            console.log(
              `[v0] Investment synced to goal: ₹${amount} → ${goal.id} (new total: ₹${newCurrentAmount})`,
            )
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error syncing investment expense to goals:", error)
      // Don't throw - this is a background sync operation
    }
  },

  async removeInvestmentExpenseFromGoals(userId: string, expenseId: string): Promise<void> {
    try {
      const supabase = createClient()

      // Find all contributions linked to this expense
      const { data: contributions, error: fetchError } = await supabase
        .from("goal_contributions")
        .select("id, goal_id, amount")
        .eq("user_id", userId)
        .eq("expense_id", expenseId)

      if (fetchError) {
        console.error("[v0] Error fetching contributions for removal:", fetchError)
        return
      }

      if (!contributions || contributions.length === 0) {
        return // No contributions to remove
      }

      // Remove contributions and update goals
      for (const contribution of contributions) {
        const { error: deleteError } = await supabase
          .from("goal_contributions")
          .delete()
          .eq("id", contribution.id)

        if (deleteError) {
          console.error(`[v0] Error deleting contribution:`, deleteError)
          continue
        }

        // Update goal's current_amount
        const { data: goal, error: goalError } = await supabase
          .from("savings_goals")
          .select("current_amount, target_amount")
          .eq("id", contribution.goal_id)
          .maybeSingle()

        if (goalError || !goal) {
          console.error(`[v0] Error fetching goal for update:`, goalError)
          continue
        }

        const newCurrentAmount = Math.max(0, Number(goal.current_amount || 0) - contribution.amount)
        const newStatus = newCurrentAmount >= Number(goal.target_amount) ? "completed" : "active"

        const { error: updateError } = await supabase
          .from("savings_goals")
          .update({
            current_amount: newCurrentAmount,
            status: newStatus,
          })
          .eq("id", contribution.goal_id)

        if (updateError) {
          console.error(`[v0] Error updating goal after removal:`, updateError)
        } else {
          console.log(`[v0] Investment removed from goal: ₹${contribution.amount} removed from goal`)
        }
      }
    } catch (error) {
      console.error("[v0] Error removing investment from goals:", error)
    }
  },
}
