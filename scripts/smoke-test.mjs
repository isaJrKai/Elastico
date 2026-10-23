import assert from 'node:assert/strict'

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'

async function expectStatus(path, expectedStatus) {
  const response = await fetch(new URL(path, base), {
    headers: { accept: 'text/html,application/json' },
  })
  assert.equal(
    response.status,
    expectedStatus,
    `${path}: expected HTTP ${expectedStatus}, received ${response.status}`,
  )
  return response
}

const home = await expectStatus('/', 200)
assert.match(home.headers.get('content-type') || '', /text\/html/i)
console.log('PASS: home page returns HTML')

await expectStatus('/api/cron/sync?force=true', 401)
console.log('PASS: force query cannot bypass cron authentication')

await expectStatus('/api/sync', 401)
console.log('PASS: manual sync requires authentication')

await expectStatus('/api/predictions/compute', 401)
console.log('PASS: prediction computation requires authentication')

console.log('Elastico production smoke tests passed')
