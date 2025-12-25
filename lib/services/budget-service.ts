import { createClient } from "@/lib/supabase/client"
import type { ExpenseCategory } from "@/lib/types"

interface BudgetLimit {
  id: string
  user_id: string
  category: ExpenseCategory
  monthly_limit: number
  created_at: string
  updated_at: string
}

export const budgetService = {
  async setBudgetLimit(category: ExpenseCategory, limit: number): Promise<BudgetLimit> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("budget_limits")
      .upsert(
        {
          user_id: userData.user.id,
          category,
          monthly_limit: limit,
        },
        { onConflict: "user_id,category" },
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getBudgetLimits(): Promise<BudgetLimit[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase.from("budget_limits").select("*").eq("user_id", userData.user.id)

    if (error) throw error
    return data || []
  },

  async deleteBudgetLimit(category: ExpenseCategory): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("budget_limits")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("category", category)

    if (error) throw error
  },

  async createBudgetAlert(
    monthYear: string,
    category: string,
    spentAmount: number,
    budgetLimit: number,
  ): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const alertType = spentAmount > budgetLimit ? "exceeded" : "warning"

    const { error } = await supabase.from("budget_alerts").insert({
      user_id: userData.user.id,
      month_year: monthYear,
      category,
      spent_amount: spentAmount,
      budget_limit: budgetLimit,
      alert_type: alertType,
    })

    if (error) throw error
  },

  async getBudgetAlerts(monthYear: string): Promise<any[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("budget_alerts")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("month_year", monthYear)
      .eq("is_acknowledged", false)

    if (error) throw error
    return data || []
  },
}
