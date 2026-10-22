import test from 'node:test'
import assert from 'node:assert/strict'
import { hashSessionToken, toPublicUser } from '../src/lib/auth'

test('public user serializer never exposes credentials or internal account state', () => {
  const result = toPublicUser({
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
    plan: 'free',
    isActive: true,
    passwordHash: 'must-not-leak',
    twoFactorSecret: 'must-not-leak',
    sessionId: 'internal-session-id',
    failedLogins: 5,
    lockedUntil: new Date(),
    isBanned: true,
    banReason: 'internal note',
  })

  assert.equal(result.id, 'user-1')
  assert.equal(result.email, 'user@example.com')
  for (const key of ['passwordHash', 'twoFactorSecret', 'sessionId', 'failedLogins', 'lockedUntil', 'isBanned', 'banReason']) {
    assert.equal(Object.hasOwn(result, key), false, `unexpected public field: ${key}`)
  }
})

test('session token storage uses a deterministic SHA-256 digest, not the bearer token', () => {
  const token = 'example.bearer.token'
  const digest = hashSessionToken(token)
  assert.equal(digest, hashSessionToken(token))
  assert.equal(digest.length, 64)
  assert.notEqual(digest, token)
  assert.notEqual(digest, hashSessionToken(token + '-different'))
})
