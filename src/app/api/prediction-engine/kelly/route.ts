import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { db } from '@/lib/db'
import { DEFAULT_CONFIG, calculateKelly, calculatePortfolioAllocation, type EngineConfig, type KellyResult, type PortfolioAllocation } from '@/lib/prediction-engine'

// ── POST /api/prediction-engine/kelly ───────────────────────────────────────────
// Calculate Kelly Criterion for a single bet or portfolio

// Read persisted risk controls so non-admin clients cannot override global limits.
async function getEffectiveRiskSettings(
  role: string,
  requested: { fractionalKelly?: number; maxBankrollRisk?: number; minEdgeThreshold?: number }
) {
  let saved: Partial<EngineConfig> = {}
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'prediction_engine_config' } })
    if (setting?.type === 'json') {
      const parsed: unknown = JSON.parse(setting.value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) saved = parsed as Partial<EngineConfig>
    }
  } catch (error) {
    console.warn('[KELLY] Could not load saved risk settings; using defaults:', error)
  }

  const savedKelly = typeof saved.kellyFraction === 'number' && Number.isFinite(saved.kellyFraction)
    && saved.kellyFraction >= 0.05 && saved.kellyFraction <= 1 ? saved.kellyFraction : DEFAULT_CONFIG.kellyFraction
  const savedRisk = typeof saved.maxBankrollRisk === 'number' && Number.isFinite(saved.maxBankrollRisk)
    && saved.maxBankrollRisk >= 0.01 && saved.maxBankrollRisk <= 0.25 ? saved.maxBankrollRisk : DEFAULT_CONFIG.maxBankrollRisk
  const savedEdge = typeof saved.minEdgeThreshold === 'number' && Number.isFinite(saved.minEdgeThreshold)
    && saved.minEdgeThreshold >= 0.005 && saved.minEdgeThreshold <= 0.2 ? saved.minEdgeThreshold : DEFAULT_CONFIG.minEdgeThreshold
  const isAdmin = role === 'admin'

  return {
    fractionalKelly: isAdmin ? requested.fractionalKelly ?? savedKelly : savedKelly,
    maxBankrollRisk: isAdmin ? requested.maxBankrollRisk ?? savedRisk : savedRisk,
    minEdgeThreshold: isAdmin ? requested.minEdgeThreshold ?? savedEdge : savedEdge,
  }
}


export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const rl = rateLimit(`kelly:${auth.user.id}`, 20, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })

    const body = await request.json()
    const mode = body.mode || 'single'

    if (mode === 'portfolio') {
      const { outcomes, bankroll, fractionalKelly, maxBankrollRisk, minEdgeThreshold } = body
      if (!Array.isArray(outcomes) || outcomes.length === 0 || outcomes.length > 20) {
        return NextResponse.json({ error: 'outcomes must be an array containing 1 to 20 entries' }, { status: 400 })
      }
      if (!outcomes.every((out: any) =>
        out && typeof out.label === 'string' && out.label.trim()
        && typeof out.modelProb === 'number' && Number.isFinite(out.modelProb) && out.modelProb >= 0 && out.modelProb <= 1
        && typeof out.odds === 'number' && Number.isFinite(out.odds) && out.odds > 1.01 && out.odds <= 1000
      )) {
        return NextResponse.json({ error: 'Each outcome requires a label, model probability between 0 and 1, and decimal odds greater than 1.01' }, { status: 400 })
      }
      if (bankroll !== undefined && (typeof bankroll !== 'number' || !Number.isFinite(bankroll) || bankroll <= 0 || bankroll > 1_000_000_000)) {
        return NextResponse.json({ error: 'bankroll must be a finite positive number within supported limits' }, { status: 400 })
      }
      if (fractionalKelly !== undefined && (typeof fractionalKelly !== 'number' || !Number.isFinite(fractionalKelly) || fractionalKelly <= 0 || fractionalKelly > 1)) {
        return NextResponse.json({ error: 'fractionalKelly must be in (0, 1]' }, { status: 400 })
      }
      if (maxBankrollRisk !== undefined && (typeof maxBankrollRisk !== 'number' || !Number.isFinite(maxBankrollRisk) || maxBankrollRisk <= 0 || maxBankrollRisk > 0.25)) {
        return NextResponse.json({ error: 'maxBankrollRisk must be in (0, 0.25]' }, { status: 400 })
      }
      if (minEdgeThreshold !== undefined && (typeof minEdgeThreshold !== 'number' || !Number.isFinite(minEdgeThreshold) || minEdgeThreshold < 0 || minEdgeThreshold > 0.2)) {
        return NextResponse.json({ error: 'minEdgeThreshold must be in [0, 0.2]' }, { status: 400 })
      }
      const riskSettings = await getEffectiveRiskSettings(auth.user.role, { fractionalKelly, maxBankrollRisk, minEdgeThreshold })
      const allocation: PortfolioAllocation = calculatePortfolioAllocation(
        outcomes,
        bankroll ?? 1000,
        riskSettings.fractionalKelly,
        riskSettings.maxBankrollRisk,
        riskSettings.minEdgeThreshold
      )
      return NextResponse.json({ success: true, mode: 'portfolio', data: allocation })
    }

    // Single bet Kelly calculation
    const { modelProbability, bookmakerOdds, bankroll, fractionalKelly, maxBankrollRisk, minEdgeThreshold } = body
    if (modelProbability === undefined || !bookmakerOdds) {
      return NextResponse.json({ error: 'modelProbability and bookmakerOdds are required' }, { status: 400 })
    }
    if (typeof modelProbability !== 'number' || modelProbability < 0.01 || modelProbability > 0.99) {
      return NextResponse.json({ error: 'modelProbability must be between 0.01 and 0.99' }, { status: 400 })
    }
    if (typeof bookmakerOdds !== 'number' || bookmakerOdds <= 1.01) {
      return NextResponse.json({ error: 'bookmakerOdds must be greater than 1.01' }, { status: 400 })
    }
    if (bankroll !== undefined && (typeof bankroll !== 'number' || bankroll <= 0)) {
      return NextResponse.json({ error: 'bankroll must be greater than 0' }, { status: 400 })
    }

    if (fractionalKelly !== undefined && (typeof fractionalKelly !== 'number' || !Number.isFinite(fractionalKelly) || fractionalKelly <= 0 || fractionalKelly > 1)) {
      return NextResponse.json({ error: 'fractionalKelly must be in (0, 1]' }, { status: 400 })
    }
    if (maxBankrollRisk !== undefined && (typeof maxBankrollRisk !== 'number' || !Number.isFinite(maxBankrollRisk) || maxBankrollRisk <= 0 || maxBankrollRisk > 0.25)) {
      return NextResponse.json({ error: 'maxBankrollRisk must be in (0, 0.25]' }, { status: 400 })
    }
    if (minEdgeThreshold !== undefined && (typeof minEdgeThreshold !== 'number' || !Number.isFinite(minEdgeThreshold) || minEdgeThreshold < 0 || minEdgeThreshold > 0.2)) {
      return NextResponse.json({ error: 'minEdgeThreshold must be in [0, 0.2]' }, { status: 400 })
    }

    const riskSettings = await getEffectiveRiskSettings(auth.user.role, { fractionalKelly, maxBankrollRisk, minEdgeThreshold })
    const result: KellyResult = calculateKelly(
      modelProbability,
      bookmakerOdds,
      bankroll ?? 1000,
      riskSettings.fractionalKelly,
      riskSettings.minEdgeThreshold,
      riskSettings.maxBankrollRisk
    )

    return NextResponse.json({ success: true, mode: 'single', data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}