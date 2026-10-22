import test from 'node:test'
import assert from 'node:assert/strict'
import { getRequestToken, hashSessionToken, hasValidCookieRequestOrigin, toPublicUser } from '../src/lib/auth'
import { POST as demoLogin } from '../src/app/api/auth/demo/route'
import { validatePassword } from '../src/lib/security'

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

test('demo authentication endpoint is disabled', async () => {
  const response = await demoLogin()
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('new passwords require 12 characters and mixed character classes', () => {
  assert.equal(validatePassword('Abc123!xy').isStrong, false)
  assert.equal(validatePassword('Abcdef123!xy').isStrong, true)
  assert.equal(validatePassword('abcdefghijkl').isStrong, false)
})

test('cookie sessions are parsed without exposing bearer tokens to JavaScript', () => {
  const req = new Request('https://app.example.com/api/private', {
    headers: { cookie: 'theme=dark; elastico_session=opaque-token' },
  })
  assert.deepEqual(getRequestToken(req), { token: 'opaque-token', source: 'cookie' })
})

test('cookie-authenticated mutations require a same-origin Origin header', () => {
  const sameOrigin = new Request('https://app.example.com/api/private', {
    method: 'POST',
    headers: {
      host: 'app.example.com',
      'x-forwarded-proto': 'https',
      origin: 'https://app.example.com',
      cookie: 'elastico_session=opaque-token',
    },
  })
  const crossOrigin = new Request('https://app.example.com/api/private', {
    method: 'POST',
    headers: {
      host: 'app.example.com',
      'x-forwarded-proto': 'https',
      origin: 'https://attacker.example',
      cookie: 'elastico_session=opaque-token',
    },
  })
  assert.equal(hasValidCookieRequestOrigin(sameOrigin), true)
  assert.equal(hasValidCookieRequestOrigin(crossOrigin), false)
})
