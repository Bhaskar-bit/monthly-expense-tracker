"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidateTag } from "next/cache"

export async function createSavingsGoalAction(name: string, targetAmount: number) {
  try {
    if (!name || name.trim().length === 0) {
      throw new Error("Goal name is required")
    }

    if (targetAmount <= 0) {
      throw new Error("Target amount must be greater than zero")
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    // Get the highest current priority
    const { data: existingGoals, error: fetchError } = await supabase
      .from("savings_goals")
      .select("priority")
      .eq("user_id", userData.user.id)
      .order("priority", { ascending: false })
      .limit(1)

    if (fetchError) {
      throw fetchError
    }

    // Calculate next priority (default to 1 if no goals exist)
    const nextPriority = existingGoals && existingGoals.length > 0 ? (existingGoals[0].priority || 0) + 1 : 1

    // Create new goal
    const { data: goal, error } = await supabase
      .from("savings_goals")
      .insert({
        user_id: userData.user.id,
        name: name.trim(),
        target_amount: targetAmount,
        current_amount: 0,
        priority: nextPriority,
        status: "active",
        goal_type: "custom",
        monthly_allocation: 0,
        allocation_percentage: 0,
      })
      .select()
      .single()

    if (error) throw error

    console.log(`[v0] Created savings goal: ${name} (priority: ${nextPriority})`)

    revalidateTag("savings-goals")

    return { success: true, goal }
  } catch (error) {
    console.error("[v0] Error creating savings goal:", error)
    throw error
  }
}

export async function updateGoalPriorityAction(goalId: string, newPriority: number) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    // Verify goal belongs to user
    const { data: goal, error: fetchError } = await supabase
      .from("savings_goals")
      .select("user_id")
      .eq("id", goalId)
      .maybeSingle()

    if (fetchError || !goal || goal.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    const { error } = await supabase
      .from("savings_goals")
      .update({ priority: newPriority })
      .eq("id", goalId)

    if (error) throw error

    console.log(`[v0] Updated goal ${goalId} priority to ${newPriority}`)

    revalidateTag("savings-goals")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error updating goal priority:", error)
    throw error
  }
}

export async function deleteSavingsGoalAction(goalId: string) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    // Verify goal belongs to user
    const { data: goal, error: fetchError } = await supabase
      .from("savings_goals")
      .select("user_id, priority")
      .eq("id", goalId)
      .maybeSingle()

    if (fetchError || !goal || goal.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    // Delete goal
    const { error: deleteError } = await supabase.from("savings_goals").delete().eq("id", goalId)

    if (deleteError) throw deleteError

    // Delete all contributions for this goal
    await supabase.from("goal_contributions").delete().eq("goal_id", goalId)

    console.log(`[v0] Deleted savings goal: ${goalId}`)

    revalidateTag("savings-goals")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error deleting savings goal:", error)
    throw error
  }
}

export async function completeSavingsGoalAction(goalId: string) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) {
      throw new Error("Not authenticated")
    }

    // Verify goal belongs to user
    const { data: goal, error: fetchError } = await supabase
      .from("savings_goals")
      .select("user_id")
      .eq("id", goalId)
      .maybeSingle()

    if (fetchError || !goal || goal.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    const { error } = await supabase
      .from("savings_goals")
      .update({ status: "completed" })
      .eq("id", goalId)

    if (error) throw error

    console.log(`[v0] Marked goal ${goalId} as completed`)

    revalidateTag("savings-goals")

    return { success: true }
  } catch (error) {
    console.error("[v0] Error completing savings goal:", error)
    throw error
  }
}
