import { z } from "zod"

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { data: T; error: null } | { data: null; error: string } {
  try {
    const validatedData = schema.parse(data)
    return { data: validatedData as T, error: null }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0]
      return { data: null, error: firstError.message }
    }
    return { data: null, error: "Validation failed" }
  }
}

export function validateInputStrict<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.parse(data)
  return result as T
}

export function getValidationErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.errors[0]?.message || "Validation error"
  }
  if (error instanceof Error) {
    return error.message
  }
  return "An unknown error occurred"
}
