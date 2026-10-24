import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import {
  runStochasticSimulation,
  runFullMatchAnalysis,
  type MatchInput,
  type EngineConfig,
} from '@/lib/prediction-engine'

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const rl = rateLimit(`simulate:${auth.user.id}`, 5, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const payload = body as Record<string, unknown>
    const rawInput = payload.matchInput
    if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
      return NextResponse.json({ error: 'matchInput is required' }, { status: 400 })
    }
    const matchInput = rawInput as Partial<MatchInput>
    const config = (payload.config && typeof payload.config === 'object' && !Array.isArray(payload.config)
      ? payload.config : {}) as Partial<EngineConfig>
    const bankroll = payload.bankroll ?? 1000
    const rawOpeningOdds = payload.openingOdds
    const openingOdds = rawOpeningOdds as { home: number; draw: number; away: number } | undefined
    const mode = payload.mode ?? 'full'

    if (mode !== 'full' && mode !== 'simulation-only') {
      return NextResponse.json({ error: 'mode must be full or simulation-only' }, { status: 400 })
    }
    if (typeof matchInput.homeTeam !== 'string' || !matchInput.homeTeam.trim() ||
        typeof matchInput.awayTeam !== 'string' || !matchInput.awayTeam.trim()) {
      return NextResponse.json({ error: 'homeTeam and awayTeam are required' }, { status: 400 })
    }
    const isFiniteIn = (value: unknown, min: number, max: number): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    if (!isFiniteIn(matchInput.homeXg, 0.1, 5) || !isFiniteIn(matchInput.awayXg, 0.1, 5)) {
      return NextResponse.json({ error: 'homeXg and awayXg must be supplied as numbers between 0.1 and 5; defaults are not substituted' }, { status: 400 })
    }
    if (!isFiniteIn(matchInput.homeElo, 500, 3000) || !isFiniteIn(matchInput.awayElo, 500, 3000)) {
      return NextResponse.json({ error: 'homeElo and awayElo must be numbers between 500 and 3000' }, { status: 400 })
    }
    if (!isFiniteIn(bankroll, 1, 1_000_000_000)) {
      return NextResponse.json({ error: 'bankroll must be a finite number between 1 and 1000000000' }, { status: 400 })
    }
    const runs = config.simulationRuns ?? 150000
    if (!Number.isInteger(runs) || runs < 1000 || runs > 150000) {
      return NextResponse.json({ error: 'simulationRuns must be an integer between 1000 and 150000' }, { status: 400 })
    }
    if (!isFiniteIn(config.kellyFraction ?? 0.25, 0, 1) ||
        !isFiniteIn(config.minEdgeThreshold ?? 0.02, 0, 1) ||
        !isFiniteIn(config.maxBankrollRisk ?? 0.05, 0, 0.25)) {
      return NextResponse.json({ error: 'Kelly fraction, minimum edge, or bankroll risk is outside supported bounds' }, { status: 400 })
    }
    if (matchInput.correlation !== undefined && !isFiniteIn(matchInput.correlation, -0.95, 0.95)) {
      return NextResponse.json({ error: 'correlation must be between -0.95 and 0.95' }, { status: 400 })
    }
    if (config.garchEnabled !== undefined && typeof config.garchEnabled !== 'boolean') {
      return NextResponse.json({ error: 'garchEnabled must be a boolean' }, { status: 400 })
    }
    if (config.jumpDiffusionEnabled !== undefined && typeof config.jumpDiffusionEnabled !== 'boolean') {
      return NextResponse.json({ error: 'jumpDiffusionEnabled must be a boolean' }, { status: 400 })
    }
    if (matchInput.historicalResiduals !== undefined) {
      const residuals = matchInput.historicalResiduals
      if (!residuals || !Array.isArray(residuals.home) || !Array.isArray(residuals.away) ||
          residuals.home.length > 500 || residuals.away.length > 500 ||
          [...residuals.home, ...residuals.away].some(value => !isFiniteIn(value, -20, 20))) {
        return NextResponse.json({ error: 'historicalResiduals must contain at most 500 finite values per team, each between -20 and 20' }, { status: 400 })
      }
    }
    if (matchInput.injuries !== undefined) {
      if (!Array.isArray(matchInput.injuries) || matchInput.injuries.length > 50 ||
          matchInput.injuries.some(injury => !injury || typeof injury.teamId !== 'string' ||
            typeof injury.playerName !== 'string' ||
            !['out', 'doubtful', 'questionable'].includes(injury.status) ||
            !['star', 'key', 'rotation'].includes(injury.importance) ||
            !isFiniteIn(injury.xgImpact, 0, 1))) {
        return NextResponse.json({ error: 'injuries must contain at most 50 valid entries with xgImpact between 0 and 1' }, { status: 400 })
      }
    }
    if (matchInput.bookmakerOdds !== undefined && matchInput.bookmakerOdds !== null) {
      const odds = matchInput.bookmakerOdds
      if (!odds || !isFiniteIn(odds.home, 1.01, 1000) || !isFiniteIn(odds.draw, 1.01, 1000) || !isFiniteIn(odds.away, 1.01, 1000)) {
        return NextResponse.json({ error: 'All bookmaker odds must be finite numbers greater than 1.01 and no greater than 1000' }, { status: 400 })
      }
    }
    if (rawOpeningOdds !== undefined) {
      if (!rawOpeningOdds || typeof rawOpeningOdds !== 'object' || Array.isArray(rawOpeningOdds)) {
        return NextResponse.json({ error: 'openingOdds must contain home, draw, and away decimal odds' }, { status: 400 })
      }
      const odds = rawOpeningOdds as Record<string, unknown>
      if (!isFiniteIn(odds.home, 1.01, 1000) || !isFiniteIn(odds.draw, 1.01, 1000) || !isFiniteIn(odds.away, 1.01, 1000)) {
        return NextResponse.json({ error: 'All opening odds must be finite numbers greater than 1.01 and no greater than 1000' }, { status: 400 })
      }
    }

    const input: MatchInput = {
      homeTeam: matchInput.homeTeam.trim(),
      awayTeam: matchInput.awayTeam.trim(),
      homeTeamId: matchInput.homeTeamId,
      awayTeamId: matchInput.awayTeamId,
      homeXg: matchInput.homeXg,
      awayXg: matchInput.awayXg,
      homeGoalsConceded: matchInput.homeGoalsConceded ?? 0,
      awayGoalsConceded: matchInput.awayGoalsConceded ?? 0,
      homeElo: matchInput.homeElo,
      awayElo: matchInput.awayElo,
      bookmakerOdds: matchInput.bookmakerOdds ?? null,
      historicalResiduals: matchInput.historicalResiduals,
      injuries: matchInput.injuries,
      correlation: matchInput.correlation,
    }

    const fullConfig: EngineConfig = {
      simulationRuns: runs,
      kellyFraction: config.kellyFraction ?? 0.25,
      garchEnabled: config.garchEnabled ?? true,
      jumpDiffusionEnabled: config.jumpDiffusionEnabled ?? true,
      minEdgeThreshold: config.minEdgeThreshold ?? 0.02,
      maxBankrollRisk: config.maxBankrollRisk ?? 0.05,
    }

    if (mode === 'simulation-only') {
      const result = runStochasticSimulation(input, fullConfig)
      return NextResponse.json({
        success: true,
        mode: 'simulation',
        data: result,
        config: fullConfig,
        engineInfo: {
          model: 'ELASTICO Merton Jump-Diffusion v3.0',
          simulationRuns: fullConfig.simulationRuns,
          garchEnabled: fullConfig.garchEnabled,
          jumpDiffusionEnabled: fullConfig.jumpDiffusionEnabled,
          computedAt: new Date().toISOString(),
        },
      })
    }

    const result = runFullMatchAnalysis(input, bankroll, openingOdds, fullConfig)

    return NextResponse.json({
      success: true,
      mode: 'full-analysis',
      data: result,
      config: fullConfig,
      engineInfo: {
        model: 'ELASTICO Merton Jump-Diffusion v3.0',
        features: [
          'GARCH(1,1) Volatility Calibration',
          'Merton Jump-Diffusion Process',
          'Bivariate Correlated Poisson',
          'Monte Carlo Simulation',
          'Kelly Criterion Bankroll Management',
          'Market Signal Analysis',
          'xG Luck Adjustment',
          'Injury Impact Overlay',
        ],
        simulationRuns: fullConfig.simulationRuns,
        computedAt: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[PREDICTION ENGINE]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    engine: 'ELASTICO Stochastic Prediction Engine',
    version: '3.0',
    status: 'available',
    validationStatus: 'not-yet-independently-validated',
    capabilities: [
      'Merton Jump-Diffusion Simulation',
      'GARCH(1,1) Volatility Calibration',
      'Bivariate Poisson Monte Carlo',
      'Kelly Criterion Capital Allocation',
      'Market Signal Tracking',
      'xG Luck Adjustment',
      'Injury Impact Modeling',
      'Portfolio Covariance Analysis',
    ],
    defaultConfig: {
      simulationRuns: 150000,
      kellyFraction: 0.25,
      garchEnabled: true,
      jumpDiffusionEnabled: true,
    },
  })
}