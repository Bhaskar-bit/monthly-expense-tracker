import { createClient } from "@/lib/supabase/client"
import type { Expense, ExpenseCategory } from "@/lib/types"
import { CreateExpenseSchema } from "@/lib/schemas/expense-schema"
import { validateInputStrict } from "@/lib/utils/validation-helpers"
import type { PaginatedResult } from "@/lib/utils/pagination"
import { calculateOffset, createPaginatedResult, validatePaginationParams } from "@/lib/utils/pagination"

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

export const expenseService = {
  async createExpense(input: CreateExpenseServiceInput): Promise<Expense> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    validateInputStrict(CreateExpenseSchema, {
      category: input.category,
      amount: input.amount,
      description: input.description,
      expense_date: input.expense_date,
    })

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: userData.user.id,
        ...input,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getExpensesByMonth(monthId: string): Promise<Expense[]> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("month_id", monthId)
      .eq("user_id", userData.user.id)
      .order("expense_date", { ascending: false })

    if (error) throw error
    return data || []
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    // Verify user owns this expense before deleting
    const { data: expense } = await supabase.from("expenses").select("user_id").eq("id", expenseId).single()

    if (expense?.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId)

    if (error) throw error
  },

  async updateExpense(input: UpdateExpenseInput): Promise<Expense> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { id, ...updates } = input

    // Verify user owns this expense before updating
    const { data: expense } = await supabase.from("expenses").select("user_id").eq("id", id).single()

    if (expense?.user_id !== userData.user.id) {
      throw new Error("Unauthorized")
    }

    const { data, error } = await supabase.from("expenses").update(updates).eq("id", id).select().single()

    if (error) throw error
    return data
  },

  async getExpensesByMonthPaginated(monthId: string, page = 1, pageSize = 20): Promise<PaginatedResult<Expense>> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { page: validatedPage, pageSize: validatedPageSize } = validatePaginationParams(page, pageSize)
    const offset = calculateOffset(validatedPage, validatedPageSize)

    // Get total count
    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("month_id", monthId)
      .eq("user_id", userData.user.id)

    // Get paginated data
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("month_id", monthId)
      .eq("user_id", userData.user.id)
      .order("expense_date", { ascending: false })
      .range(offset, offset + validatedPageSize - 1)

    if (error) throw error

    return createPaginatedResult(data || [], validatedPage, validatedPageSize, count || 0)
  },

  async getExpensesByYearPaginated(year: number, page = 1, pageSize = 50): Promise<PaginatedResult<Expense>> {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) throw new Error("Not authenticated")

    const { page: validatedPage, pageSize: validatedPageSize } = validatePaginationParams(page, pageSize)
    const offset = calculateOffset(validatedPage, validatedPageSize)

    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // Get total count
    const { count } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)

    // Get paginated data
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userData.user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false })
      .range(offset, offset + validatedPageSize - 1)

    if (error) throw error

    return createPaginatedResult(data || [], validatedPage, validatedPageSize, count || 0)
  },
}
