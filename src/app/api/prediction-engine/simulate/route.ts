import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import {
  runStochasticSimulation,
  runFullMatchAnalysis,
  type MatchInput,
  type EngineConfig,
} from '@/lib/prediction-engine'

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const matchInput: MatchInput = body.matchInput
    const config: Partial<EngineConfig> = body.config || {}
    const bankroll = body.bankroll || 1000
    const openingOdds = body.openingOdds

    if (!matchInput || !matchInput.homeTeam || !matchInput.awayTeam) {
      return NextResponse.json({ error: 'matchInput with homeTeam and awayTeam is required' }, { status: 400 })
    }

    const input: MatchInput = {
      homeTeam: matchInput.homeTeam,
      awayTeam: matchInput.awayTeam,
      homeTeamId: matchInput.homeTeamId,
      awayTeamId: matchInput.awayTeamId,
      homeXg: matchInput.homeXg ?? 1.5,
      awayXg: matchInput.awayXg ?? 1.1,
      homeGoalsConceded: matchInput.homeGoalsConceded ?? 0.9,
      awayGoalsConceded: matchInput.awayGoalsConceded ?? 1.2,
      homeElo: matchInput.homeElo ?? 1600,
      awayElo: matchInput.awayElo ?? 1500,
      bookmakerOdds: matchInput.bookmakerOdds || { home: 2.10, draw: 3.40, away: 3.50 },
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