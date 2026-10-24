import test from 'node:test'
import assert from 'node:assert/strict'
import { toPublicAnnouncement } from '../src/lib/public-announcements'

test('public announcement serializer maps content and omits admin-only fields', () => {
  const result = toPublicAnnouncement({
    id: 'announcement-1',
    title: 'Maintenance',
    content: 'Scheduled maintenance tonight.',
    type: 'warning',
    targetRole: 'admin',
    isActive: true,
    expiresAt: new Date('2026-10-24T00:00:00.000Z'),
    createdAt: new Date('2026-10-23T00:00:00.000Z'),
  } as any)

  assert.deepEqual(result, {
    id: 'announcement-1',
    title: 'Maintenance',
    message: 'Scheduled maintenance tonight.',
    type: 'warning',
    isBreaking: true,
    createdAt: '2026-10-23T00:00:00.000Z',
  })
  assert.equal(Object.hasOwn(result, 'targetRole'), false)
  assert.equal(Object.hasOwn(result, 'isActive'), false)
  assert.equal(Object.hasOwn(result, 'expiresAt'), false)
})
