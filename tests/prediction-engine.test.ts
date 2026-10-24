import test from 'node:test'
import assert from 'node:assert/strict'
import {
  runStochasticSimulation,
  runFullMatchAnalysis,
  type EngineConfig,
  type MatchInput,
} from '../src/lib/prediction-engine'

const config: EngineConfig = {
  simulationRuns: 1_000,
  kellyFraction: 0.25,
  garchEnabled: true,
  jumpDiffusionEnabled: true,
  minEdgeThreshold: 0.02,
  maxBankrollRisk: 0.05,
}

const baseInput: MatchInput = {
  homeTeam: 'Home FC',
  awayTeam: 'Away FC',
  homeXg: 1.45,
  awayXg: 1.1,
  homeGoalsConceded: 1.0,
  awayGoalsConceded: 1.3,
  homeElo: 1580,
  awayElo: 1510,
}

test('simulation returns finite, normalized outcome probabilities', () => {
  const result = runStochasticSimulation(baseInput, config)
  const { homeVictory, draw, awayVictory } = result.matchProbabilities
  for (const value of [homeVictory, draw, awayVictory]) {
    assert.ok(Number.isFinite(value))
    assert.ok(value >= 0 && value <= 1)
  }
  assert.ok(Math.abs(homeVictory + draw + awayVictory - 1) < 1e-9)
  assert.ok(Number.isFinite(result.expectedMeans.home) && result.expectedMeans.home >= 0)
  assert.ok(Number.isFinite(result.expectedMeans.away) && result.expectedMeans.away >= 0)
})

test('full analysis does not invent observed goals when only xG is supplied', () => {
  const result = runFullMatchAnalysis(baseInput, 1000, undefined, config)
  assert.equal(result.luckAdjustment.home.luckAdjustedGoals, baseInput.homeXg)
  assert.equal(result.luckAdjustment.away.luckAdjustedGoals, baseInput.awayXg)
  assert.equal(result.luckAdjustment.home.luckFactor, 1)
  assert.equal(result.luckAdjustment.away.luckFactor, 1)
  assert.equal(result.kellyResults, undefined)
  assert.equal(result.portfolioAllocation, undefined)
})

test('observed goals are used for luck adjustment only when supplied', () => {
  const result = runFullMatchAnalysis({
    ...baseInput,
    homeActualGoalsPerGame: 1.9,
    awayActualGoalsPerGame: 0.8,
    homeSampleSize: 30,
    awaySampleSize: 30,
  }, 1000, undefined, config)
  assert.equal(result.luckAdjustment.home.luckAdjustedGoals, 1.9)
  assert.equal(result.luckAdjustment.away.luckAdjustedGoals, 0.8)
})

test('Kelly analysis uses only the supplied 1X2 odds, never proxy totals odds', () => {
  const result = runFullMatchAnalysis({
    ...baseInput,
    bookmakerOdds: { home: 2.2, draw: 3.2, away: 3.5 },
  }, 1000, undefined, config)
  assert.deepEqual(Object.keys(result.kellyResults ?? {}).sort(), ['away', 'draw', 'home'])
})
