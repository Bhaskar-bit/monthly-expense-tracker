"use client"

import { createClient } from "@/lib/supabase/client"
import type { Expense, ExpenseCategory } from "@/lib/types"
import type { PaginatedResult } from "@/lib/utils/pagination"

interface CreateExpenseServiceInput {
  month_id: string
  category: ExpenseCategory
  amount: number
  description?: string | null
  expense_date: string
}

interface UpdateExpenseInput {
  id: string
  category?: ExpenseCategory
  amount?: number
  description?: string | null
  expense_date?: string
}

// This service now only contains client-side operations
// Server-side expense creation is handled in expense-actions.ts (Server Action)
export const expenseService = {
  async getExpensesByMonth(monthId: string): Promise<Expense[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("month_id", monthId)
      .order("expense_date", { ascending: false })

    if (error) throw error
    return data || []
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId)
    if (error) throw error
  },

  async updateExpense(input: UpdateExpenseInput): Promise<Expense> {
    const supabase = createClient()
    const { id, ...updates } = input

    const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single()

    if (error) throw error
    return data
  },

  async getExpensesByMonthPaginated(monthId: string, page = 1, pageSize = 20): Promise<PaginatedResult<Expense>> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("month_id", monthId)
      .eq("user_id", userData.user.id)

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("month_id", monthId)
      .eq("user_id", userData.user.id)
      .order("expense_date", { ascending: false })
      .range(page * pageSize - pageSize, page * pageSize - 1)

    if (error) throw error

    const total = count || 0
    return {
      data: data || [],
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  },

  async getExpensesByYearPaginated(year: number, page = 1, pageSize = 50): Promise<PaginatedResult<Expense>> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userData.user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false })
      .range(page * pageSize - pageSize, page * pageSize - 1)

    if (error) throw error

    const total = count || 0
    return {
      data: data || [],
      pagination: {
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  },
}
