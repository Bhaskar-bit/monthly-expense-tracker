import { createClient } from "@/lib/supabase/server"
import type { GoalContribution } from "@/lib/types"

interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  priority: number
  status: string
  user_id: string
}

interface AllocationResult {
  goalId: string
  allocatedAmount: number
  goalName: string
  goalCompleted: boolean
}

export const goalContributionService = {
  async getGoalContributionsByExpense(expenseId: string, supabaseClient?: any): Promise<GoalContribution[]> {
    const supabase = supabaseClient || (await createClient())
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

  async getGoalContributionsByGoal(goalId: string, supabaseClient?: any): Promise<GoalContribution[]> {
    const supabase = supabaseClient || (await createClient())
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

  async deleteContribution(contributionId: string, supabaseClient?: any): Promise<void> {
    const supabase = supabaseClient || (await createClient())
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    // Get the contribution to retrieve goal_id and amount
    const { data: contribution } = await supabase
      .from("goal_contributions")
      .select("goal_id, amount, user_id")
      .eq("id", contributionId)
      .maybeSingle()

    if (!contribution || contribution.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    // Delete the contribution
    const { error: deleteError } = await supabase
      .from("goal_contributions")
      .delete()
      .eq("id", contributionId)

    if (deleteError) throw deleteError

    // Revert the goal's current_amount
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("current_amount, target_amount")
      .eq("id", contribution.goal_id)
      .maybeSingle()

    if (goal) {
      const newAmount = Math.max(0, Number(goal.current_amount || 0) - contribution.amount)
      const newStatus = newAmount >= Number(goal.target_amount) ? "completed" : "active"

      await supabase
        .from("savings_goals")
        .update({ current_amount: newAmount, status: newStatus })
        .eq("id", contribution.goal_id)
    }
  },

  /**
   * Allocate investment amount sequentially to savings goals by priority
   * Priority 1 gets filled first, then Priority 2, then Priority 3, etc.
   */
  async allocateInvestmentByPriority(
    userId: string,
    expenseId: string,
    amount: number,
    expenseDate: string,
    supabaseClient?: any,
  ): Promise<AllocationResult[]> {
    const supabase = supabaseClient || (await createClient())

    // Prefer the atomic Postgres RPC (applied via migration
    // supabase/migrations/20260403000000_allocate_investment_transaction.sql).
    // Falls back to the JS implementation with compensating rollback if the
    // function does not exist yet.
    const { data: rpcData, error: rpcError } = await supabase.rpc("allocate_investment_by_priority", {
      p_user_id: userId,
      p_expense_id: expenseId,
      p_amount: amount,
      p_expense_date: expenseDate,
    })

    if (!rpcError) {
      return (rpcData ?? []).map((row: any) => ({
        goalId: row.goal_id,
        allocatedAmount: Number(row.allocated_amount),
        goalName: row.goal_name,
        goalCompleted: row.goal_completed,
      }))
    }

    // RPC not available yet — fall back to JS with compensating rollback
    if (rpcError.code !== "PGRST202") {
      // PGRST202 = function not found; any other error is unexpected
      console.error("[v0] RPC allocate_investment_by_priority failed:", rpcError)
      throw rpcError
    }

    const allocations: AllocationResult[] = []
    const insertedContributionIds: string[] = []

    try {
      const { data: goals, error: goalsError } = await supabase
        .from("savings_goals")
        .select("id, name, target_amount, current_amount, priority, status")
        .eq("user_id", userId)
        .in("status", ["active", "inactive"])
        .order("priority", { ascending: true })

      if (goalsError) throw goalsError
      if (!goals || goals.length === 0) return []

      let remainingAmount = amount

      for (const goal of goals) {
        if (remainingAmount <= 0) break

        const amountNeeded = Number(goal.target_amount) - Number(goal.current_amount || 0)
        if (amountNeeded <= 0) continue

        const allocationAmount = Math.min(remainingAmount, amountNeeded)
        const newCurrentAmount = Number(goal.current_amount || 0) + allocationAmount
        const goalCompleted = newCurrentAmount >= Number(goal.target_amount)

        const { data: inserted, error: insertError } = await supabase
          .from("goal_contributions")
          .insert({
            goal_id: goal.id,
            user_id: userId,
            expense_id: expenseId,
            amount: allocationAmount,
            contribution_date: expenseDate,
          })
          .select("id")
          .single()

        if (insertError) {
          console.error(`[v0] Error creating contribution for goal ${goal.id}:`, insertError)
          throw insertError
        }

        insertedContributionIds.push(inserted.id)

        const { error: updateError } = await supabase
          .from("savings_goals")
          .update({ current_amount: newCurrentAmount, status: goalCompleted ? "completed" : "active" })
          .eq("id", goal.id)

        if (updateError) {
          console.error(`[v0] Error updating goal ${goal.id}:`, updateError)
          throw updateError
        }

        allocations.push({ goalId: goal.id, allocatedAmount: allocationAmount, goalName: goal.name, goalCompleted })
        remainingAmount -= allocationAmount
      }

      return allocations
    } catch (error) {
      // Compensating rollback: remove any contributions inserted in this pass
      if (insertedContributionIds.length > 0) {
        await supabase.from("goal_contributions").delete().in("id", insertedContributionIds)
      }
      console.error("[v0] Error allocating investment by priority (rolled back):", error)
      throw error
    }
  },

  /**
   * Backfill historical investment expenses with priority-based allocation
   */
  async backfillHistoricalInvestmentsByPriority(userId: string, supabaseClient?: any): Promise<{
    synced: number
    skipped: number
  }> {
    const supabase = supabaseClient || (await createClient())

    try {
      // First, check if user has any savings goals at all
      const { data: allGoals, error: goalsCheckError } = await supabase
        .from("savings_goals")
        .select("id, status")
        .eq("user_id", userId)

      if (goalsCheckError) {
        console.error("[v0] Error checking for savings goals:", goalsCheckError)
        return { synced: 0, skipped: 0 }
      }

      if (!allGoals || allGoals.length === 0) {
        return { synced: 0, skipped: 0 }
      }

      // Get all investment expenses ordered by date
      const { data: investmentExpenses, error: expensesError } = await supabase
        .from("expenses")
        .select("id, amount, expense_date")
        .eq("user_id", userId)
        .eq("category", "Investments")
        .order("expense_date", { ascending: true })

      if (expensesError || !investmentExpenses) {
        console.error("[v0] Error fetching investment expenses:", expensesError)
        return { synced: 0, skipped: 0 }
      }

      if (investmentExpenses.length === 0) {
        return { synced: 0, skipped: 0 }
      }

      let synced = 0
      let skipped = 0

      // Process each investment expense
      for (const expense of investmentExpenses) {
        // Check if this expense already has contributions
        const { data: existingContributions, error: checkError } = await supabase
          .from("goal_contributions")
          .select("id")
          .eq("expense_id", expense.id)
          .limit(1)

        if (checkError) {
          console.error(`[v0] Error checking contributions for expense ${expense.id}:`, checkError)
          skipped++
          continue
        }

        // Skip if contributions already exist
        if (existingContributions && existingContributions.length > 0) {
          skipped++
          continue
        }

        try {
          // Allocate this investment by priority
          const allocations = await this.allocateInvestmentByPriority(
            userId,
            expense.id,
            Number(expense.amount),
            expense.expense_date,
            supabase,
          )

          if (allocations && allocations.length > 0) {
            synced++
          } else {
            skipped++
          }
        } catch (allocationError) {
          console.error(`[v0] Error allocating expense ${expense.id}:`, allocationError)
          skipped++
        }
      }

      return { synced, skipped }
    } catch (error) {
      console.error("[v0] Error backfilling investments:", error)
      throw error
    }
  },

  /**
   * Update goal priority when user reorders them
   */
  async updateGoalPriority(goalId: string, newPriority: number): Promise<void> {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("savings_goals")
      .update({ priority: newPriority })
      .eq("id", goalId)
      .eq("user_id", userData.user.id)

    if (error) throw error
  },

  /**
   * Get all savings goals ordered by priority
   */
  async getSavingsGoalsByPriority(userId: string, supabaseClient?: any): Promise<SavingsGoal[]> {
    const supabase = supabaseClient || (await createClient())

    const { data: goals, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching savings goals:", error)
      throw error
    }

    return (goals || []) as SavingsGoal[]
  },
}
