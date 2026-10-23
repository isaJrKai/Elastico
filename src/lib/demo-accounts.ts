/**
 * Public demo identities are intentionally low-privilege and reserved.
 * They must never overlap with real customer accounts or administrator accounts.
 */
export const DEMO_ACCOUNTS = {
  'user@elastico.ai': { plan: 'free', label: 'Free Demo' },
  'pro@elastico.ai': { plan: 'pro', label: 'Pro Demo' },
  'elite@elastico.ai': { plan: 'elite', label: 'Elite Demo' },
} as const

export type DemoPlan = (typeof DEMO_ACCOUNTS)[keyof typeof DEMO_ACCOUNTS]['plan']

export function resolveDemoAccount(email: unknown, requestedPlan: unknown) {
  if (typeof email !== 'string' || typeof requestedPlan !== 'string') return null
  const normalizedEmail = email.trim().toLowerCase()
  const account = DEMO_ACCOUNTS[normalizedEmail as keyof typeof DEMO_ACCOUNTS]
  if (!account || account.plan !== requestedPlan) return null
  return { email: normalizedEmail, ...account }
}

export function isReservedDemoEmail(email: unknown): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() in DEMO_ACCOUNTS
}

export function isEligibleExistingDemoUser(user: {
  provider?: string | null
  role?: string | null
  isActive?: boolean
  isBanned?: boolean
} | null | undefined): boolean {
  return Boolean(
    user &&
    user.provider === 'demo' &&
    user.role === 'user' &&
    user.isActive === true &&
    user.isBanned === false
  )
}
