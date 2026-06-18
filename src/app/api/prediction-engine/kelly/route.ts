import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { calculateKelly, calculatePortfolioAllocation, type KellyResult, type PortfolioAllocation } from '@/lib/prediction-engine'

// ── POST /api/prediction-engine/kelly ───────────────────────────────────────────
// Calculate Kelly Criterion for a single bet or portfolio

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    const body = await request.json()
    const mode = body.mode || 'single'

    if (mode === 'portfolio') {
      // Multi-asset portfolio allocation with covariance adjustment
      const { outcomes, bankroll, correlationMatrix } = body
      if (!outcomes || !Array.isArray(outcomes) || outcomes.length === 0) {
        return NextResponse.json({ error: 'outcomes array is required for portfolio mode' }, { status: 400 })
      }
      const allocation: PortfolioAllocation = calculatePortfolioAllocation(
        outcomes,
        bankroll || 1000,
        correlationMatrix
      )
      return NextResponse.json({ success: true, mode: 'portfolio', data: allocation })
    }

    // Single bet Kelly calculation
    const { modelProbability, bookmakerOdds, bankroll, fractionalKelly } = body
    if (modelProbability === undefined || !bookmakerOdds) {
      return NextResponse.json({ error: 'modelProbability and bookmakerOdds are required' }, { status: 400 })
    }

    const result: KellyResult = calculateKelly(
      modelProbability,
      bookmakerOdds,
      bankroll || 1000,
      fractionalKelly ?? 0.25
    )

    return NextResponse.json({ success: true, mode: 'single', data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}