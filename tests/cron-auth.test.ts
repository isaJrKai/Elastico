import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidCronSecret } from '../src/lib/cron-auth'

const strongSecret = 'a-random-test-secret-that-is-at-least-32-chars-long'

test('rejects missing or weak configured secrets', () => {
  assert.equal(isValidCronSecret(undefined, strongSecret, null), false)
  assert.equal(isValidCronSecret('short-secret', 'short-secret', null), false)
  assert.equal(isValidCronSecret('', strongSecret, null), false)
})

test('rejects missing and mismatched request credentials', () => {
  assert.equal(isValidCronSecret(strongSecret, null, null), false)
  assert.equal(isValidCronSecret(strongSecret, 'wrong-secret', null), false)
  assert.equal(isValidCronSecret(strongSecret, null, 'Bearer wrong-secret'), false)
})

test('accepts the configured secret through the manual header', () => {
  assert.equal(isValidCronSecret(strongSecret, strongSecret, null), true)
})

test('accepts the configured secret through the Vercel cron bearer header', () => {
  assert.equal(isValidCronSecret(strongSecret, null, `Bearer ${strongSecret}`), true)
  assert.equal(isValidCronSecret(strongSecret, null, `bearer ${strongSecret}`), true)
})

test('does not let a mismatched custom header override the bearer credential', () => {
  assert.equal(isValidCronSecret(strongSecret, 'wrong-secret', `Bearer ${strongSecret}`), false)
})
