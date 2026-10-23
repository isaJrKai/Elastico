import { timingSafeEqual } from 'node:crypto'

/**
 * Accept Vercel's documented Authorization: Bearer CRON_SECRET header and the
 * internal x-cron-secret header used by the admin-triggered sync route.
 * Query parameters must never bypass this check.
 */
export function isValidCronRequest(
  headers: Headers,
  expected: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!expected) return false
  const expectedBytes = Buffer.from(expected)
  if (expectedBytes.length < 32) return false

  const authorization = headers.get('authorization')
  const bearerSecret = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  const candidates = [headers.get('x-cron-secret'), bearerSecret]

  return candidates.some((supplied) => {
    if (!supplied) return false
    const suppliedBytes = Buffer.from(supplied)
    if (suppliedBytes.length !== expectedBytes.length) return false
    return timingSafeEqual(suppliedBytes, expectedBytes)
  })
}
