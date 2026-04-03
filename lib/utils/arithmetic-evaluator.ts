/**
 * Safely evaluates simple arithmetic expressions in input values
 * Supports: +, -, *, / operations
 * Examples: "100 + 50" => 150, "1000 - 200" => 800, "50 * 2" => 100
 * 
 * @param expression - The input string that may contain arithmetic operations
 * @returns The calculated result or the original value if parsing fails
 */
export function evaluateArithmeticExpression(expression: string): number | null {
  if (!expression || expression.trim() === "") {
    return null
  }

  try {
    // Only allow digits, operators (+, -, *, /), spaces, and decimal points
    const sanitized = expression.trim()
    
    // Check for valid characters only
    if (!/^[\d\s+\-*/.()]+$/.test(sanitized)) {
      return null
    }

    // Prevent division by zero and other malicious patterns
    if (sanitized.includes("//") || sanitized.includes("/*")) {
      return null
    }

    // Use Function constructor instead of eval for slightly better safety
    // This evaluates mathematical expressions safely
    const result = Function('"use strict"; return (' + sanitized + ')')()

    // Ensure result is a valid number
    if (typeof result === "number" && isFinite(result)) {
      return result
    }

    return null
  } catch (error) {
    // If evaluation fails, return null (component will use original input)
    return null
  }
}

/**
 * Formats a number with commas for display
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumberInput(num: number): string {
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
