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


  it('does not let the force query parameter bypass cron authentication', async () => {
    const previousSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = secret
    try {
      const [{ GET }, { NextRequest }] = await Promise.all([
        import('../src/app/api/cron/sync/route'),
        import('next/server'),
      ])
      const response = await GET(new NextRequest('http://localhost/api/cron/sync?force=true'))
      assert.equal(response.status, 401)
    } finally {
      if (previousSecret === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = previousSecret
    }
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
