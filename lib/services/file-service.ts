import { VALID_IMAGE_TYPES, EXPENSE_LIMITS } from "@/lib/constants/expenses"

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export const fileService = {
  validateImageFile(file: File): FileValidationResult {
    // Check file type
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${VALID_IMAGE_TYPES.join(", ")}`,
      }
    }

    // Check file size
    const maxSizeBytes = EXPENSE_LIMITS.MAX_IMAGE_SIZE_MB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds ${EXPENSE_LIMITS.MAX_IMAGE_SIZE_MB}MB limit`,
      }
    }

    // Check file name for suspicious patterns
    if (!/^[\w\s.-]+$/.test(file.name)) {
      return {
        valid: false,
        error: "File name contains invalid characters",
      }
    }

    return { valid: true }
  },

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Failed to read file"))
    })
  },

  async compressImage(base64: string, maxWidth = 1200, maxHeight = 1200): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let { width, height } = img

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL("image/jpeg", 0.8))
      }
      img.onerror = () => resolve(base64)
      img.src = base64
    })
  },
}
