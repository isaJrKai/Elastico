import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidCronRequest } from '../src/lib/cron-auth'

const secret = 'cron-test-secret-0123456789abcdef0123456789'

describe('cron request authentication', () => {
  it('accepts Vercel Authorization Bearer secret', () => {
    assert.equal(isValidCronRequest(new Headers({
      authorization: `Bearer ${secret}`,
    }), secret), true)
  })

  it('accepts the internal x-cron-secret header', () => {
    assert.equal(isValidCronRequest(new Headers({
      'x-cron-secret': secret,
    }), secret), true)
  })

  it('rejects missing or incorrect credentials', () => {
    assert.equal(isValidCronRequest(new Headers(), secret), false)
    assert.equal(isValidCronRequest(new Headers({
      authorization: 'Bearer wrong',
    }), secret), false)
    assert.equal(isValidCronRequest(new Headers({
      authorization: `Basic ${secret}`,
    }), secret), false)
  })

  it('fails closed when the configured secret is missing or too short', () => {
    assert.equal(isValidCronRequest(new Headers({
      authorization: `Bearer ${secret}`,
    }), undefined), false)
    assert.equal(isValidCronRequest(new Headers({
      'x-cron-secret': 'short',
    }), 'short'), false)
  })
})
