import test from 'node:test'
import assert from 'node:assert/strict'
import { dixonColesFromExpectedGoals } from '../src/lib/predictions'

test('Dixon-Coles probabilities normalize and use the full score grid', () => {
  const result = dixonColesFromExpectedGoals(1.8, 0.9)
  assert.equal(result.matrix.length, 9)
  assert.ok(result.matrix.every(row => row.length === 9))
  const total = result.homeWinProb + result.drawProb + result.awayWinProb
  assert.ok(Math.abs(total - 1) < 1e-9)
  assert.ok(result.homeWinProb > result.awayWinProb)
})

test('Dixon-Coles is symmetric for equal expected goals', () => {
  const result = dixonColesFromExpectedGoals(1.25, 1.25)
  assert.ok(Math.abs(result.homeWinProb - result.awayWinProb) < 1e-9)
})

test('Dixon-Coles rejects invalid goal intensities rather than producing fake probabilities', () => {
  assert.throws(() => dixonColesFromExpectedGoals(Number.NaN, 1.2), /Expected goals/)
  assert.throws(() => dixonColesFromExpectedGoals(1.2, 0), /Expected goals/)
})
