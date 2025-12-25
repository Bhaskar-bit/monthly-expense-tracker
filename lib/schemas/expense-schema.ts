import { z } from "zod"
import { EXPENSE_CATEGORIES, EXPENSE_LIMITS } from "@/lib/constants/expenses"

export const CreateExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: "Invalid category selected" }),
  }),
  amount: z
    .number()
    .min(EXPENSE_LIMITS.MIN_AMOUNT, "Amount must be greater than 0")
    .max(EXPENSE_LIMITS.MAX_AMOUNT, "Amount exceeds maximum limit"),
  description: z.string().max(EXPENSE_LIMITS.MAX_DESCRIPTION_LENGTH).nullable().optional(),
  expense_date: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>

export const ReceiptScanSchema = z.object({
  image: z.string().startsWith("data:image/", "Invalid image format"),
})

export type ReceiptScanInput = z.infer<typeof ReceiptScanSchema>

export const ReceiptDataSchema = z.object({
  amount: z.number().positive().finite(),
  description: z.string().min(1).max(EXPENSE_LIMITS.MAX_DESCRIPTION_LENGTH),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type ReceiptData = z.infer<typeof ReceiptDataSchema>
