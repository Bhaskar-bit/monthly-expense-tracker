import { createClient } from "@/lib/supabase/client"
import type { InvestmentReturn } from "@/lib/types"

interface CreateReturnInput {
  goal_id: string
  return_amount: number
  return_date: string
  return_source: "interest" | "dividend" | "capital_appreciation" | "manual_entry"
  notes?: string | null
}

export const investmentReturnsService = {
  async addReturn(input: CreateReturnInput): Promise<InvestmentReturn> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("investment_returns")
      .insert({
        user_id: userData.user.id,
        ...input,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getReturnsByGoal(goalId: string): Promise<InvestmentReturn[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("investment_returns")
      .select("*")
      .eq("goal_id", goalId)
      .eq("user_id", userData.user.id)
      .order("return_date", { ascending: false })

    if (error) throw error
    return data || []
  },

  async deleteReturn(returnId: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    // Verify user owns this return before deleting
    const { data: investmentReturn } = await supabase
      .from("investment_returns")
      .select("user_id")
      .eq("id", returnId)
      .single()

    if (investmentReturn?.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    const { error } = await supabase.from("investment_returns").delete().eq("id", returnId)

    if (error) throw error
  },

  async updateGoalProjectedReturn(goalId: string, projectedReturnRate: number): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("savings_goals")
      .update({ projected_return_rate: projectedReturnRate })
      .eq("id", goalId)
      .eq("user_id", userData.user.id)

    if (error) throw error
  },
}
