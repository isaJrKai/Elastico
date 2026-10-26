export interface SimulationRequestBody {
  matchInput?: unknown
  config?: unknown
  bankroll?: unknown
  mode?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidOdds(value: unknown): value is { home: number; draw: number; away: number } {
  return isRecord(value) && ['home', 'draw', 'away'].every(key => {
    const odd = value[key]
    return typeof odd === 'number' && Number.isFinite(odd) && odd > 1.01 && odd <= 1000
  })
}

function isValidResiduals(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.home) || !Array.isArray(value.away)) return false
  return [value.home, value.away].every(series =>
    series.length <= 512 && series.every(item =>
      typeof item === 'number' && Number.isFinite(item) && item >= -20 && item <= 20
    )
  )
}

function isValidInjuries(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > 100) return false
  const statuses = ['out', 'doubtful', 'questionable']
  const importanceLevels = ['star', 'key', 'rotation']
  return value.every(item =>
    isRecord(item)
    && typeof item.teamId === 'string' && item.teamId.trim().length > 0
    && typeof item.playerName === 'string' && item.playerName.trim().length > 0
    && typeof item.status === 'string' && statuses.includes(item.status)
    && typeof item.importance === 'string' && importanceLevels.includes(item.importance)
    && typeof item.xgImpact === 'number' && Number.isFinite(item.xgImpact) && item.xgImpact >= 0 && item.xgImpact <= 1
  )
}

/** Validate externally supplied simulation inputs before any expensive work. */
export function validateSimulationRequest(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.matchInput)) {
    return 'matchInput with homeTeam and awayTeam is required'
  }

  const match = body.matchInput
  if (typeof match.homeTeam !== 'string' || !match.homeTeam.trim() || match.homeTeam.length > 200
    || typeof match.awayTeam !== 'string' || !match.awayTeam.trim() || match.awayTeam.length > 200) {
    return 'matchInput with valid homeTeam and awayTeam names is required'
  }
  for (const key of ['homeTeamId', 'awayTeamId'] as const) {
    const value = match[key]
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 200)) {
      return `${key} must be a non-empty string when supplied`
    }
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
  if (mode !== 'full' && mode !== 'simulation-only') {
    return 'mode must be full or simulation-only'
  }
  if (mode !== 'simulation-only' && !isValidOdds(match.bookmakerOdds)) {
    return 'Current decimal bookmaker odds for home, draw and away are required for full market analysis'
  }
  if (match.bookmakerOdds !== undefined && match.bookmakerOdds !== null && !isValidOdds(match.bookmakerOdds)) {
    return 'bookmakerOdds must contain finite decimal odds > 1.01 and <= 1000 for home, draw, and away'
  }
  if (body.openingOdds !== undefined && body.openingOdds !== null && !isValidOdds(body.openingOdds)) {
    return 'openingOdds must contain finite decimal odds > 1.01 and <= 1000 for home, draw, and away'
  }

  if (body.bankroll !== undefined && (typeof body.bankroll !== 'number'
    || !Number.isFinite(body.bankroll) || body.bankroll <= 0 || body.bankroll > 1_000_000_000)) {
    return 'bankroll must be a finite positive number within supported limits'
  }

  if (match.correlation !== undefined && (typeof match.correlation !== 'number'
    || !Number.isFinite(match.correlation) || match.correlation < -0.95 || match.correlation > 0.95)) {
    return 'correlation must be between -0.95 and 0.95'
  }
  if (match.historicalResiduals !== undefined && !isValidResiduals(match.historicalResiduals)) {
    return 'historicalResiduals must contain finite home/away residual arrays of at most 512 values, each between -20 and 20'
  }
  if (match.injuries !== undefined && !isValidInjuries(match.injuries)) {
    return 'injuries must contain at most 100 valid player injury records'
  }

  if (body.config !== undefined && !isRecord(body.config)) {
    return 'config must be an object when supplied'
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
    || typeof edge !== 'number' || !Number.isFinite(edge) || edge < 0 || edge > 0.2
    || typeof risk !== 'number' || !Number.isFinite(risk) || risk <= 0 || risk > 0.25) {
    return 'Invalid risk configuration: Kelly must be (0, 1], edge must be [0, 0.2], max risk must be (0, 0.25]'
  }
  for (const key of ['garchEnabled', 'jumpDiffusionEnabled'] as const) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean') {
      return `${key} must be a boolean`
    }
  }

  return null
}
