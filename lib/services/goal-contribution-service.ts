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
}
