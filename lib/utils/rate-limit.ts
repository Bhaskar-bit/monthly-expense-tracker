const requestCounts = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
}

export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG): boolean {
  const now = Date.now()
  const record = requestCounts.get(key)

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + config.windowMs })
    return true
  }

  if (record.count < config.maxRequests) {
    record.count++
    return true
  }

  return false
}

export function getRateLimitStatus(key: string, config: RateLimitConfig = DEFAULT_CONFIG) {
  const record = requestCounts.get(key)
  const now = Date.now()

  if (!record || now > record.resetTime) {
    return {
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      isLimited: false,
    }
  }

  return {
    remaining: Math.max(0, config.maxRequests - record.count),
    resetTime: record.resetTime,
    isLimited: record.count >= config.maxRequests,
  }
}
