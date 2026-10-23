import assert from 'node:assert/strict'
import {
  isEligibleExistingDemoUser,
  isReservedDemoEmail,
  resolveDemoAccount,
} from '../src/lib/demo-accounts'

const free = resolveDemoAccount(' USER@ELASTICO.AI ', 'free')
assert.deepEqual(free, { email: 'user@elastico.ai', plan: 'free', label: 'Free Demo' })
assert.deepEqual(resolveDemoAccount('pro@elastico.ai', 'pro'), {
  email: 'pro@elastico.ai',
  plan: 'pro',
  label: 'Pro Demo',
})
assert.deepEqual(resolveDemoAccount('elite@elastico.ai', 'elite'), {
  email: 'elite@elastico.ai',
  plan: 'elite',
  label: 'Elite Demo',
})

// Never allow admin or arbitrary identities through the public demo path.
assert.equal(resolveDemoAccount('admin@elastico.ai', 'admin'), null)
assert.equal(resolveDemoAccount('admin@elastico.ai', 'elite'), null)
assert.equal(resolveDemoAccount('victim@example.com', 'free'), null)
assert.equal(resolveDemoAccount('pro@elastico.ai', 'elite'), null)
assert.equal(resolveDemoAccount({}, 'free'), null)

assert.equal(isReservedDemoEmail('USER@ELASTICO.AI'), true)
assert.equal(isReservedDemoEmail('admin@elastico.ai'), false)
assert.equal(isReservedDemoEmail('customer@example.com'), false)

// Only an active, unbanned, non-admin account explicitly marked as demo is eligible.
assert.equal(isEligibleExistingDemoUser({
  provider: 'demo', role: 'user', isActive: true, isBanned: false,
}), true)
assert.equal(isEligibleExistingDemoUser({
  provider: 'demo', role: 'admin', isActive: true, isBanned: false,
}), false)
assert.equal(isEligibleExistingDemoUser({
  provider: 'email', role: 'user', isActive: true, isBanned: false,
}), false)
assert.equal(isEligibleExistingDemoUser({
  provider: 'demo', role: 'user', isActive: false, isBanned: false,
}), false)
assert.equal(isEligibleExistingDemoUser({
  provider: 'demo', role: 'user', isActive: true, isBanned: true,
}), false)
assert.equal(isEligibleExistingDemoUser(null), false)

console.log('Auth hardening policy tests passed.')
