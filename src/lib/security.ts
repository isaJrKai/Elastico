/**
 * ELASTICO Security Utility Functions
 * Provides input sanitization, validation, CSRF, rate limiting, and audit logging.
 */

// ── Input Sanitization ──────────────────────────────────────────────────────

/**
 * Removes common XSS vectors from a string.
 * Strips HTML tags, JavaScript URIs, and event handlers.
 */
export function sanitizeInput(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/data:/gi, 'blocked:')
    .replace(/vbscript:/gi, '')
    .trim()
}

// ── Email Validation ────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Validates an email address with strict regex.
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }
  if (email.length > 254) {
    return { valid: false, error: 'Email is too long' }
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  return { valid: true }
}

// ── Password Validation ─────────────────────────────────────────────────────

interface PasswordStrength {
  score: number // 0-4
  label: string
  isStrong: boolean
  feedback: string[]
}

/**
 * Checks password strength and returns a score with feedback.
 * Score: 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong
 */
export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = []
  let score = 0

  if (!password) {
    return { score: 0, label: 'Empty', isStrong: false, feedback: ['Password is required'] }
  }

  if (password.length < 6) {
    feedback.push('At least 6 characters')
  } else {
    score++
  }

  if (password.length >= 10) score++

  if (/[A-Z]/.test(password)) {
    score++
  } else {
    feedback.push('Add uppercase letters')
  }

  if (/[0-9]/.test(password)) {
    score++
  } else {
    feedback.push('Add numbers')
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score++
  } else {
    feedback.push('Add special characters')
  }

  if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) {
    score = 4
  }

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    isStrong: score >= 3,
    feedback,
  }
}

// ── CSRF Token ──────────────────────────────────────────────────────────────

/**
 * Generates a CSRF token using crypto.getRandomValues.
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  }
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// ── Per-User Rate Limiting ──────────────────────────────────────────────────

const userRateLimits = new Map<string, { count: number; resetTime: number }>()

/**
 * Per-user rate limiter for specific actions.
 * Returns true if the action is allowed, false if rate limited.
 */
export function rateLimitByUser(
  userId: string,
  action: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${userId}:${action}`
  const now = Date.now()

  const record = userRateLimits.get(key)

  if (record && now < record.resetTime) {
    record.count++
    const remaining = Math.max(0, maxRequests - record.count)
    const resetIn = Math.ceil((record.resetTime - now) / 1000)
    return { allowed: record.count <= maxRequests, remaining, resetIn }
  }

  userRateLimits.set(key, { count: 1, resetTime: now + windowMs })
  return { allowed: true, remaining: maxRequests - 1, resetIn: Math.ceil(windowMs / 1000) }
}

// ── Security Audit Log ──────────────────────────────────────────────────────

/**
 * Logs a security event. In production, this would write to a database or logging service.
 * For now, it outputs to console with a structured format.
 */
export function securityAuditLog(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    metadata,
  }

  // In production, write to DB or external logging service
  console.log('[SECURITY AUDIT]', JSON.stringify(entry))
}