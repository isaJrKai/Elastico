import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateElo, poissonProbabilities, dixonColes } from '../src/lib/predictions'

function assertProbabilityVector(values: number[], tolerance = 1e-9) {
  for (const value of values) {
    assert.ok(Number.isFinite(value), `probability must be finite: ${value}`)
    assert.ok(value >= 0 && value <= 1, `probability outside [0, 1]: ${value}`)
  }
  assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= tolerance)
}

test('ELO output probabilities are finite and sum to one', () => {
  const result = calculateElo(1500, 1500, 20, 0)
  assertProbabilityVector([result.homeProb, result.drawProb, result.awayProb])
  assert.ok(result.expectedHomeGoals > 0)
  assert.ok(result.expectedAwayGoals > 0)
})

test('Poisson market probabilities are bounded and internally consistent', () => {
  const result = poissonProbabilities(1.4, 1.1)
  for (const value of [result.homeWinProb, result.drawProb, result.awayWinProb, result.overProb, result.underProb, result.bttsProb]) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
  assert.ok(Math.abs(result.overProb + result.underProb - 1) < 1e-12)
  // The score matrix is truncated at maxGoals, so allow a small tail loss.
  assert.ok(result.homeWinProb + result.drawProb + result.awayWinProb > 0.99)
  assert.ok(result.homeWinProb + result.drawProb + result.awayWinProb <= 1.001)
})

test('Dixon-Coles adjusted score matrix produces coherent 1X2 probabilities', () => {
  const result = dixonColes(8, 8, 1, 1, 1, 1)
  assertProbabilityVector([result.homeWinProb, result.drawProb, result.awayWinProb], 1e-8)
  for (const row of result.matrix) {
    for (const value of row) {
      assert.ok(Number.isFinite(value))
      assert.ok(value >= 0)
    }
  }
})
