import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { validateSimulationRequest } from '@/lib/prediction-input-validation'
import {
  runStochasticSimulation,
  runFullMatchAnalysis,
  DEFAULT_CONFIG,
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
    const validationError = validateSimulationRequest(body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const matchInput = body.matchInput as MatchInput
    const config: Partial<EngineConfig> = body.config || {}
    const bankroll = body.bankroll ?? 1000
    const openingOdds = body.openingOdds
    const mode = body.mode || 'full'

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

    // Load the persisted admin configuration so the configuration UI actually affects simulations.
    let savedConfig: Partial<EngineConfig> = {}
    try {
      const setting = await db.systemSetting.findUnique({ where: { key: 'prediction_engine_config' } })
      if (setting?.type === 'json') {
        const parsed: unknown = JSON.parse(setting.value)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          savedConfig = parsed as Partial<EngineConfig>
        }
      }
    } catch (error) {
      // The simulation can still run with safe defaults if the settings record is unavailable.
      console.warn('[PREDICTION ENGINE] Could not load saved config; using defaults:', error)
    }

    const adminOverrides: Partial<EngineConfig> = auth.user.role === 'admin' ? config : {}
    const fullConfig: EngineConfig = {
      simulationRuns: config.simulationRuns ?? savedConfig.simulationRuns ?? DEFAULT_CONFIG.simulationRuns,
      kellyFraction: adminOverrides.kellyFraction ?? savedConfig.kellyFraction ?? DEFAULT_CONFIG.kellyFraction,
      garchEnabled: adminOverrides.garchEnabled ?? savedConfig.garchEnabled ?? DEFAULT_CONFIG.garchEnabled,
      jumpDiffusionEnabled: adminOverrides.jumpDiffusionEnabled ?? savedConfig.jumpDiffusionEnabled ?? DEFAULT_CONFIG.jumpDiffusionEnabled,
      minEdgeThreshold: adminOverrides.minEdgeThreshold ?? savedConfig.minEdgeThreshold ?? DEFAULT_CONFIG.minEdgeThreshold,
      maxBankrollRisk: adminOverrides.maxBankrollRisk ?? savedConfig.maxBankrollRisk ?? DEFAULT_CONFIG.maxBankrollRisk,
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
      'Exposure-Capped Portfolio Kelly Allocation',
    ],
    defaultConfig: {
      simulationRuns: 150000,
      kellyFraction: 0.25,
      garchEnabled: true,
      jumpDiffusionEnabled: true,
    },
  })
}