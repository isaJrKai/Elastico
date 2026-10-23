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
    const matchInput: MatchInput = body.matchInput
    const config: Partial<EngineConfig> = body.config || {}
    const bankroll = body.bankroll
    const openingOdds = body.openingOdds

    if (!matchInput || !matchInput.homeTeam?.trim() || !matchInput.awayTeam?.trim()) {
      return NextResponse.json({ error: 'matchInput with homeTeam and awayTeam is required' }, { status: 400 })
    }

    // The engine must not silently invent xG, goals-conceded, or team-strength
    // inputs. Callers must provide measured/estimated values with provenance.
    const requiredNumericInputs = [
      'homeXg', 'awayXg', 'homeGoalsConceded', 'awayGoalsConceded', 'homeElo', 'awayElo',
    ] as const
    const missingInputs = requiredNumericInputs.filter((key) =>
      typeof matchInput[key] !== 'number' ||
      !Number.isFinite(matchInput[key]) ||
      matchInput[key] < 0
    )
    if (missingInputs.length > 0) {
      return NextResponse.json({
        error: 'Required model inputs are missing or invalid; no defaults are fabricated.',
        missingInputs,
      }, { status: 400 })
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

    const fullConfig: EngineConfig = {
      simulationRuns: config.simulationRuns || 150000,
      kellyFraction: config.kellyFraction ?? 0.25,
      garchEnabled: config.garchEnabled ?? true,
      jumpDiffusionEnabled: config.jumpDiffusionEnabled ?? true,
      minEdgeThreshold: config.minEdgeThreshold ?? 0.02,
      maxBankrollRisk: config.maxBankrollRisk ?? 0.05,
    }

    const mode = body.mode || 'full'
    if (mode !== 'simulation-only' && mode !== 'full') {
      return NextResponse.json({ error: 'mode must be full or simulation-only' }, { status: 400 })
    }
    if (mode === 'full' && (typeof bankroll !== 'number' || !Number.isFinite(bankroll) || bankroll <= 0)) {
      return NextResponse.json({ error: 'A positive numeric bankroll is required for full analysis.' }, { status: 400 })
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
    status: 'experimental-unvalidated',
    warning: 'Endpoint availability does not imply model validation. Supply real, timestamped inputs; predictions are estimates, not guarantees.',
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