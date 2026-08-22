/**
 * ELASTICO — Neon Auth Integration
 *
 * Dual-mode auth system:
 *   - When NEON_AUTH_URL is set → delegates to Neon Auth (better-auth)
 *   - When NEON_AUTH_URL is empty → falls back to existing JWT auth
 *
 * Neon Auth manages: user accounts, sessions, OAuth, passwords
 * ELASTICO User table stores: prediction stats, preferences, achievements
 * The two are linked by email address.
 */

export const isNeonAuthEnabled = () => {
  return !!process.env.NEON_AUTH_URL
}

/**
 * Get the Neon Auth client URL.
 * Throws if Neon Auth is not configured.
 */
export const getNeonAuthUrl = () => {
  const url = process.env.NEON_AUTH_URL
  if (!url) throw new Error('NEON_AUTH_URL is not configured')
  return url
}

/**
 * Create the server-side Neon Auth configuration.
 * Used by auth API routes and middleware.
 *
 * TODO: When NEON_AUTH_URL is provided, activate by:
 *   1. Uncommenting createNeonAuth import
 *   2. Updating login/register routes to proxy to Neon Auth
 *   3. Adding auth handler route at /api/auth/[...all]/route.ts
 */
export const neonAuthConfig = {
  enabled: isNeonAuthEnabled(),
  url: process.env.NEON_AUTH_URL || '',
}
