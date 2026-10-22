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

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 65_536) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const matchInput: MatchInput = body?.matchInput
    const config: Partial<EngineConfig> = body?.config || {}
    const bankroll = body?.bankroll
    const openingOdds = body?.openingOdds

    if (!matchInput || typeof matchInput.homeTeam !== 'string' || !matchInput.homeTeam.trim()
      || typeof matchInput.awayTeam !== 'string' || !matchInput.awayTeam.trim()) {
      return NextResponse.json({ error: 'matchInput with homeTeam and awayTeam is required' }, { status: 400 })
    }

    const numericInputs: Array<[string, unknown, number, number]> = [
      ['homeXg', matchInput.homeXg, 0, 10],
      ['awayXg', matchInput.awayXg, 0, 10],
      ['homeGoalsConceded', matchInput.homeGoalsConceded, 0, 10],
      ['awayGoalsConceded', matchInput.awayGoalsConceded, 0, 10],
      ['homeElo', matchInput.homeElo, 500, 3000],
      ['awayElo', matchInput.awayElo, 500, 3000],
      ['bankroll', bankroll, 0.01, 1_000_000_000],
    ]
    for (const [field, raw, min, max] of numericInputs) {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
        return NextResponse.json({ error: `${field} must be a finite number between ${min} and ${max}` }, { status: 400 })
      }
    }

    if (!matchInput.bookmakerOdds
      || !Number.isFinite(matchInput.bookmakerOdds.home) || matchInput.bookmakerOdds.home <= 1
      || !Number.isFinite(matchInput.bookmakerOdds.draw) || matchInput.bookmakerOdds.draw <= 1
      || !Number.isFinite(matchInput.bookmakerOdds.away) || matchInput.bookmakerOdds.away <= 1) {
      return NextResponse.json({ error: 'Verified decimal bookmaker odds above 1.0 are required for all three outcomes' }, { status: 400 })
    }

    const requestedRuns = config.simulationRuns ?? 150_000
    if (!Number.isInteger(requestedRuns) || requestedRuns < 1_000 || requestedRuns > 150_000) {
      return NextResponse.json({ error: 'simulationRuns must be an integer between 1000 and 150000' }, { status: 400 })
    }
    if (config.kellyFraction !== undefined && (!Number.isFinite(config.kellyFraction) || config.kellyFraction < 0 || config.kellyFraction > 1)) {
      return NextResponse.json({ error: 'kellyFraction must be between 0 and 1' }, { status: 400 })
    }
    if (config.minEdgeThreshold !== undefined && (!Number.isFinite(config.minEdgeThreshold) || config.minEdgeThreshold < 0 || config.minEdgeThreshold > 1)) {
      return NextResponse.json({ error: 'minEdgeThreshold must be between 0 and 1' }, { status: 400 })
    }
    if (config.maxBankrollRisk !== undefined && (!Number.isFinite(config.maxBankrollRisk) || config.maxBankrollRisk < 0 || config.maxBankrollRisk > 1)) {
      return NextResponse.json({ error: 'maxBankrollRisk must be between 0 and 1' }, { status: 400 })
    }
    if (config.garchEnabled !== undefined && typeof config.garchEnabled !== 'boolean') {
      return NextResponse.json({ error: 'garchEnabled must be a boolean' }, { status: 400 })
    }
    if (config.jumpDiffusionEnabled !== undefined && typeof config.jumpDiffusionEnabled !== 'boolean') {
      return NextResponse.json({ error: 'jumpDiffusionEnabled must be a boolean' }, { status: 400 })
    }

    const input: MatchInput = {
      homeTeam: matchInput.homeTeam.trim(),
      awayTeam: matchInput.awayTeam.trim(),
      homeTeamId: matchInput.homeTeamId,
      awayTeamId: matchInput.awayTeamId,
      homeXg: matchInput.homeXg,
      awayXg: matchInput.awayXg,
      homeGoalsConceded: matchInput.homeGoalsConceded,
      awayGoalsConceded: matchInput.awayGoalsConceded,
      homeElo: matchInput.homeElo,
      awayElo: matchInput.awayElo,
      bookmakerOdds: matchInput.bookmakerOdds,
      historicalResiduals: matchInput.historicalResiduals,
      injuries: Array.isArray(matchInput.injuries) ? matchInput.injuries.slice(0, 50) : undefined,
      correlation: matchInput.correlation,
    }

    const fullConfig: EngineConfig = {
      simulationRuns: requestedRuns,
      kellyFraction: config.kellyFraction ?? 0.25,
      garchEnabled: config.garchEnabled ?? true,
      jumpDiffusionEnabled: config.jumpDiffusionEnabled ?? true,
      minEdgeThreshold: config.minEdgeThreshold ?? 0.02,
      maxBankrollRisk: config.maxBankrollRisk ?? 0.05,
    }

    const mode = body.mode || 'full'
    if (mode !== 'full' && mode !== 'simulation-only') {
      return NextResponse.json({ error: 'mode must be full or simulation-only' }, { status: 400 })
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
    status: 'operational',
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