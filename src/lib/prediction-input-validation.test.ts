import { test } from 'node:test'
import * as assert from 'node:assert/strict'
import { validateSimulationRequest } from './prediction-input-validation'

const validBody = {
  matchInput: {
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
  },
  config: { simulationRuns: 10000, kellyFraction: 0.25, minEdgeThreshold: 0.02, maxBankrollRisk: 0.05 },
  bankroll: 1000,
}

test('accepts complete, bounded, explicitly supplied match inputs', () => {
  assert.equal(validateSimulationRequest(validBody), null)
})

test('rejects missing team identity', () => {
  assert.match(validateSimulationRequest({ ...validBody, matchInput: { ...validBody.matchInput, homeTeam: '' } }) || '', /homeTeam and awayTeam/)
})

test('rejects fabricated/default-free missing xG and ELO inputs', () => {
  assert.match(validateSimulationRequest({ ...validBody, matchInput: { ...validBody.matchInput, homeXg: undefined } }) || '', /homeXg/)
  assert.match(validateSimulationRequest({ ...validBody, matchInput: { ...validBody.matchInput, awayElo: undefined } }) || '', /awayElo/)
})

test('requires current 1X2 odds for full market analysis', () => {
  assert.match(validateSimulationRequest({ ...validBody, matchInput: { ...validBody.matchInput, bookmakerOdds: undefined } }) || '', /bookmaker odds/)
  assert.equal(validateSimulationRequest({ ...validBody, mode: 'simulation-only', matchInput: { ...validBody.matchInput, bookmakerOdds: undefined } }), null)
})

test('rejects excessive Monte Carlo workload', () => {
  assert.match(validateSimulationRequest({ ...validBody, config: { simulationRuns: 1_000_000 } }) || '', /between 1,000 and 200,000/)
})

test('rejects invalid bankroll and unsafe risk parameters', () => {
  assert.match(validateSimulationRequest({ ...validBody, bankroll: -1 }) || '', /bankroll/)
  assert.match(validateSimulationRequest({ ...validBody, config: { maxBankrollRisk: 0.9 } }) || '', /Invalid risk configuration/)
})

test('rejects the same team selected as home and away', () => {
  assert.match(validateSimulationRequest({ ...validBody, matchInput: { ...validBody.matchInput, awayTeamId: 'home-1' } }) || '', /different/)
})
