import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyInjuryAdjustments,
  calculateKelly,
  calibrateGARCH,
  runFullMatchAnalysis,
  runStochasticSimulation,
  type EngineConfig,
  type MatchInput,
} from './prediction-engine'

const input: MatchInput = {
  homeTeam: 'Home FC',
  awayTeam: 'Away FC',
  homeXg: 1.6,
  awayXg: 1.1,
  homeGoalsConceded: 1.0,
  awayGoalsConceded: 1.3,
  homeElo: 1600,
  awayElo: 1500,
}

const config: EngineConfig = {
  simulationRuns: 1000,
  kellyFraction: 0.25,
  garchEnabled: false,
  jumpDiffusionEnabled: false,
  minEdgeThreshold: 0.02,
  maxBankrollRisk: 0.05,
}

test('stochastic simulation returns finite 1X2 probabilities summing to one', () => {
  const result = runStochasticSimulation(input, config)
  const p = result.matchProbabilities
  for (const value of [p.homeVictory, p.draw, p.awayVictory]) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
  assert.ok(Math.abs(p.homeVictory + p.draw + p.awayVictory - 1) < 1e-9)
  assert.ok(Number.isFinite(result.expectedMeans.home) && result.expectedMeans.home >= 0)
  assert.ok(Number.isFinite(result.expectedMeans.away) && result.expectedMeans.away >= 0)
})

test('stochastic simulation returns valid totals and BTTS probabilities', () => {
  const result = runStochasticSimulation(input, config)
  for (const value of [
    result.totalsMarket.over25,
    result.totalsMarket.under25,
    result.totalsMarket.over15,
    result.totalsMarket.over35,
    result.bothTeamsToScore,
  ]) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
  assert.ok(Math.abs(result.totalsMarket.over25 + result.totalsMarket.under25 - 1) < 1e-9)
})

test('GARCH fallback is neutral when there is insufficient residual history', () => {
  assert.equal(calibrateGARCH([]), 1)
  assert.equal(calibrateGARCH([0.1, -0.2, 0.05]), 1)
})

test('injury adjustment applies only the stated bounded impact for unavailable players', () => {
  assert.equal(applyInjuryAdjustments(2, [{
    teamId: 'home',
    playerName: 'Example',
    status: 'out',
    importance: 'star',
    xgImpact: 0.15,
  }]), 1.7)
})

test('Kelly returns no wager when model probability does not exceed implied probability', () => {
  const result = calculateKelly(0.4, 2.0, 1000, 0.25)
  assert.equal(result.action, 'NO_EDGE')
  assert.equal(result.suggestedWager, 0)
  assert.equal(result.suggestedFraction, 0)
})

test('Kelly output stays finite for a positive edge', () => {
  const result = calculateKelly(0.6, 2.2, 1000, 0.25)
  assert.ok(Number.isFinite(result.suggestedWager))
  assert.ok(result.suggestedWager >= 0 && result.suggestedWager <= 50)
})

test('full analysis does not invent observed goals from xG', () => {
  const result = runFullMatchAnalysis(input, 1000, undefined, config)
  assert.equal(result.matchInput.homeXg, input.homeXg)
  assert.equal(result.matchInput.awayXg, input.awayXg)
  assert.equal(result.luckAdjustment, null)
})

test('fractional Kelly exposure is capped at the configured maximum risk', () => {
  const result = calculateKelly(0.9, 5, 1000, 1, 0.03)
  assert.ok(result.suggestedWager <= 30)
})
