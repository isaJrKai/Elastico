/**
 * Validate cron requests without a public fallback secret.
 * Vercel Cron may use Authorization: Bearer <secret>; manual clients may use
 * x-cron-secret. Both paths require the same configured high-entropy secret.
 */
export function isValidCronSecret(
  expected: string | undefined,
  suppliedHeader: string | null,
  authorization: string | null,
): boolean {
  if (!expected || expected.length < 32) return false
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null
  const supplied = suppliedHeader || bearer
  return Boolean(supplied && supplied === expected)
}
