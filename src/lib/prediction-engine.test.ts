import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import {
  analyzeMarketSignals,
  calculateKelly,
  runFullMatchAnalysis,
  runStochasticSimulation,
  type EngineConfig,
  type MatchInput,
} from './prediction-engine'

const matchInput: MatchInput = {
  homeTeam: 'Home FC',
  awayTeam: 'Away FC',
  homeTeamId: 'home-1',
  awayTeamId: 'away-1',
  homeXg: 1.6,
  awayXg: 1.1,
  homeGoalsConceded: 0.9,
  awayGoalsConceded: 1.4,
  homeElo: 1640,
  awayElo: 1580,
  bookmakerOdds: { home: 2.1, draw: 3.4, away: 3.6 },
}

const testConfig: EngineConfig = {
  simulationRuns: 2000,
  kellyFraction: 0.25,
  garchEnabled: false,
  jumpDiffusionEnabled: false,
  minEdgeThreshold: 0.02,
  maxBankrollRisk: 0.05,
}

test('stochastic simulation returns bounded, normalized 1X2 probabilities', () => {
  const result = runStochasticSimulation(matchInput, testConfig)
  const probabilities = [
    result.matchProbabilities.homeVictory,
    result.matchProbabilities.draw,
    result.matchProbabilities.awayVictory,
  ]

  assert.ok(probabilities.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
  assert.ok(Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12)
  assert.ok(Number.isFinite(result.expectedMeans.total) && result.expectedMeans.total >= 0)
  assert.ok(result.totalsMarket.over25 >= 0 && result.totalsMarket.over25 <= 1)
  assert.ok(result.totalsMarket.under25 >= 0 && result.totalsMarket.under25 <= 1)
  assert.ok(Object.values(result.exoticScorelines).every(value => Number.isFinite(value) && value >= 0 && value <= 1))
})

test('full analysis does not fabricate observed goals or totals-market odds from 1X2 odds', () => {
  const result = runFullMatchAnalysis(matchInput, 1000, undefined, testConfig)

  assert.equal(result.matchInput.homeXg, matchInput.homeXg)
  assert.equal(result.matchInput.awayXg, matchInput.awayXg)
  assert.equal(result.luckAdjustment.home.luckAdjustedGoals, matchInput.homeXg)
  assert.equal(result.luckAdjustment.away.luckAdjustedGoals, matchInput.awayXg)
  assert.equal(result.luckAdjustment.home.luckFactor, 1)
  assert.equal(result.luckAdjustment.away.luckFactor, 1)
  assert.deepEqual(Object.keys(result.kellyResults ?? {}).sort(), ['away', 'draw', 'home'])
  assert.equal(result.portfolioAllocation?.outcomes.length, 3)
})

test('Kelly calculation never recommends a wager when model probability is below market implied probability', () => {
  const result = calculateKelly(0.3, 2.0, 1000, 0.25)
  assert.equal(result.action, 'NO_EDGE')
  assert.equal(result.suggestedWager, 0)
  assert.equal(result.suggestedFraction, 0)
})

test('Kelly calculation keeps a positive-edge wager finite and fractional', () => {
  const result = calculateKelly(0.6, 2.2, 1000, 0.25)
  assert.equal(result.action, 'BET')
  assert.ok(Number.isFinite(result.suggestedWager))
  assert.ok(result.suggestedWager > 0 && result.suggestedWager < 1000)
})

test('market signal calculation reports line movement in percentage points', () => {
  const result = analyzeMarketSignals(
    { home: 2.2, draw: 3.2, away: 3.4 },
    { home: 2.0, draw: 3.3, away: 3.7 },
    'fixture-1',
    'Home FC',
    'Away FC',
  )
  assert.ok(result.lineVelocity.home < 0)
  assert.ok(result.lineVelocity.away > 0)
  assert.equal(result.steamMove, true)
  assert.equal(result.rlmDetected, true)
  assert.ok(result.confidence >= 0 && result.confidence <= 100)
})
