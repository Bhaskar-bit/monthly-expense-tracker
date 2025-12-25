import { z } from "zod"

export const CreateMonthSchema = z.object({
  month_year: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid month format (YYYY-MM-DD)"),
  inflow: z.number().min(0, "Inflow cannot be negative").optional(),
  carryover_from_previous: z.number().min(0, "Carryover cannot be negative").optional(),
})

export type CreateMonthInput = z.infer<typeof CreateMonthSchema>

export const UpdateInflowSchema = z.object({
  inflow: z.number().min(0, "Inflow cannot be negative"),
})

export type UpdateInflowInput = z.infer<typeof UpdateInflowSchema>
