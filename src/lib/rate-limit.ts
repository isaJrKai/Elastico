const attempts = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 60_000 // 1 minute
const MAX_ATTEMPTS = 10

// Clean up old entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of attempts) {
      if (now > val.resetAt) attempts.delete(key)
    }
  }, 300_000)
}

export function rateLimit(identifier: string, max: number = MAX_ATTEMPTS, windowMs: number = WINDOW_MS): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = attempts.get(identifier)

  if (!entry || now > entry.resetAt) {
    attempts.set(identifier, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}
