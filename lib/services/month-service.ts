import { createClient } from "@/lib/supabase/client"
import type { Month } from "@/lib/types"

interface CreateMonthInput {
  month_year: string
  inflow?: number
  carryover_from_previous?: number
}

export const monthService = {
  async getMonth(monthYear: string): Promise<Month | null> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data } = await supabase
      .from("months")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("month_year", monthYear)
      .single()

    return data || null
  },

  async createMonth(input: CreateMonthInput): Promise<Month> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("months")
      .insert({
        user_id: userData.user.id,
        inflow: input.inflow ?? 0,
        carryover_from_previous: input.carryover_from_previous ?? 0,
        ...input,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateMonth(monthYear: string, updates: Partial<CreateMonthInput>): Promise<Month> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("months")
      .update(updates)
      .eq("user_id", userData.user.id)
      .eq("month_year", monthYear)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getExpensesByMonthYear(monthYear: string) {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data: monthData } = await supabase
      .from("months")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("month_year", monthYear)
      .single()

    if (!monthData) return []

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("month_id", monthData.id)
      .eq("user_id", userData.user.id)
      .order("expense_date", { ascending: false })

    return data || []
  },
}
