export interface SimulationRequestBody {
  matchInput?: unknown
  config?: unknown
  bankroll?: unknown
  mode?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validate externally supplied simulation inputs before any expensive work. */
export function validateSimulationRequest(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.matchInput)) {
    return 'matchInput with homeTeam and awayTeam is required'
  }

  const match = body.matchInput
  if (typeof match.homeTeam !== 'string' || !match.homeTeam.trim()
    || typeof match.awayTeam !== 'string' || !match.awayTeam.trim()) {
    return 'matchInput with homeTeam and awayTeam is required'
  }
  if (match.homeTeamId && match.homeTeamId === match.awayTeamId) {
    return 'Home and away teams must be different'
  }

  const numericInputs: Array<[string, unknown, number, number]> = [
    ['homeXg', match.homeXg, 0, 5],
    ['awayXg', match.awayXg, 0, 5],
    ['homeGoalsConceded', match.homeGoalsConceded, 0, 6],
    ['awayGoalsConceded', match.awayGoalsConceded, 0, 6],
    ['homeElo', match.homeElo, 500, 3000],
    ['awayElo', match.awayElo, 500, 3000],
  ]
  for (const [name, value, min, max] of numericInputs) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      return `${name} must be a real numeric input between ${min} and ${max}; defaults are not fabricated`
    }
  }

  const mode = body.mode ?? 'full'
  if (mode !== 'simulation-only') {
    const odds = match.bookmakerOdds
    if (!isRecord(odds) || ![odds.home, odds.draw, odds.away].every(
      value => typeof value === 'number' && Number.isFinite(value) && value > 1.01 && value <= 1000
    )) {
      return 'Current decimal bookmaker odds for home, draw and away are required for full market analysis'
    }
  }

  if (body.bankroll !== undefined && (typeof body.bankroll !== 'number'
    || !Number.isFinite(body.bankroll) || body.bankroll <= 0 || body.bankroll > 1_000_000_000)) {
    return 'bankroll must be a finite positive number within supported limits'
  }

  const config = isRecord(body.config) ? body.config : {}
  const runs = config.simulationRuns ?? 150000
  if (typeof runs !== 'number' || !Number.isInteger(runs) || runs < 1000 || runs > 200000) {
    return 'simulationRuns must be an integer between 1,000 and 200,000'
  }
  const kelly = config.kellyFraction ?? 0.25
  const edge = config.minEdgeThreshold ?? 0.02
  const risk = config.maxBankrollRisk ?? 0.05
  if (typeof kelly !== 'number' || !Number.isFinite(kelly) || kelly <= 0 || kelly > 1
    || typeof edge !== 'number' || !Number.isFinite(edge) || edge < 0 || edge > 1
    || typeof risk !== 'number' || !Number.isFinite(risk) || risk <= 0 || risk > 0.25) {
    return 'Invalid risk configuration: Kelly must be (0, 1], edge must be [0, 1], max risk must be (0, 0.25]'
  }

  return null
}
