import { z } from "zod"
import { VALID_IMAGE_TYPES, EXPENSE_LIMITS } from "@/lib/constants/expenses"

// Define allowed MIME types
const ALLOWED_MIME_TYPES = VALID_IMAGE_TYPES as [string, ...string[]]

export const FileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= EXPENSE_LIMITS.MAX_IMAGE_SIZE_MB * 1024 * 1024, {
      message: `File size must be less than ${EXPENSE_LIMITS.MAX_IMAGE_SIZE_MB}MB`,
    })
    .refine((file) => ALLOWED_MIME_TYPES.includes(file.type), {
      message: "File must be a valid image (JPEG, PNG, WebP)",
    }),
})

export const Base64ImageSchema = z.string().regex(/^data:image\/(jpeg|png|webp|jpg);base64,/, "Invalid image format")

export type FileUpload = z.infer<typeof FileUploadSchema>
