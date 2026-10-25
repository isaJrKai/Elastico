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

    const body = await request.json()
    const matchInput: MatchInput | undefined = body?.matchInput
    const config: Partial<EngineConfig> = body?.config || {}
    const bankroll = body?.bankroll
    const openingOdds = body?.openingOdds
    const mode = body?.mode || 'full'

    if (!matchInput || typeof matchInput.homeTeam !== 'string' || !matchInput.homeTeam.trim()
      || typeof matchInput.awayTeam !== 'string' || !matchInput.awayTeam.trim()) {
      return NextResponse.json({ error: 'matchInput with homeTeam and awayTeam is required' }, { status: 400 })
    }

    const numericInputs: Array<[string, unknown, number, number]> = [
      ['homeXg', matchInput.homeXg, 0, 5],
      ['awayXg', matchInput.awayXg, 0, 5],
      ['homeGoalsConceded', matchInput.homeGoalsConceded, 0, 6],
      ['awayGoalsConceded', matchInput.awayGoalsConceded, 0, 6],
      ['homeElo', matchInput.homeElo, 500, 3000],
      ['awayElo', matchInput.awayElo, 500, 3000],
    ]
    for (const [name, value, min, max] of numericInputs) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        return NextResponse.json({ error: `${name} must be a real numeric input between ${min} and ${max}; defaults are not fabricated` }, { status: 400 })
      }
    }
    if (mode !== 'simulation-only') {
      const odds = matchInput.bookmakerOdds
      if (!odds || ![odds.home, odds.draw, odds.away].every(value => typeof value === 'number' && Number.isFinite(value) && value > 1.01 && value <= 1000)) {
        return NextResponse.json({ error: 'Current decimal bookmaker odds for home, draw and away are required for full market analysis' }, { status: 400 })
      }
    }
    if (bankroll !== undefined && (typeof bankroll !== 'number' || !Number.isFinite(bankroll) || bankroll <= 0 || bankroll > 1_000_000_000)) {
      return NextResponse.json({ error: 'bankroll must be a finite positive number within supported limits' }, { status: 400 })
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
      bookmakerOdds: matchInput.bookmakerOdds ?? null,
      historicalResiduals: matchInput.historicalResiduals,
      injuries: matchInput.injuries,
      correlation: matchInput.correlation,
    }

    const requestedRuns = config.simulationRuns ?? 150000
    if (typeof requestedRuns !== 'number' || !Number.isInteger(requestedRuns) || requestedRuns < 1000 || requestedRuns > 200000) {
      return NextResponse.json({ error: 'simulationRuns must be an integer between 1,000 and 200,000' }, { status: 400 })
    }
    const requestedKelly = config.kellyFraction ?? 0.25
    const requestedEdge = config.minEdgeThreshold ?? 0.02
    const requestedRisk = config.maxBankrollRisk ?? 0.05
    if (typeof requestedKelly !== 'number' || !Number.isFinite(requestedKelly) || requestedKelly <= 0 || requestedKelly > 1
      || typeof requestedEdge !== 'number' || !Number.isFinite(requestedEdge) || requestedEdge < 0 || requestedEdge > 1
      || typeof requestedRisk !== 'number' || !Number.isFinite(requestedRisk) || requestedRisk <= 0 || requestedRisk > 0.25) {
      return NextResponse.json({ error: 'Invalid risk configuration: Kelly must be (0, 1], edge must be [0, 1], max risk must be (0, 0.25]' }, { status: 400 })
    }
    const fullConfig: EngineConfig = {
      simulationRuns: requestedRuns,
      kellyFraction: requestedKelly,
      garchEnabled: config.garchEnabled ?? true,
      jumpDiffusionEnabled: config.jumpDiffusionEnabled ?? true,
      minEdgeThreshold: requestedEdge,
      maxBankrollRisk: requestedRisk,
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