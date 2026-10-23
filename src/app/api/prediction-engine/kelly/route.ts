import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { calculateKelly, calculatePortfolioAllocation, type KellyResult, type PortfolioAllocation } from '@/lib/prediction-engine'

// ── POST /api/prediction-engine/kelly ───────────────────────────────────────────
// Calculate Kelly Criterion for a single bet or portfolio

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const rl = rateLimit(`kelly:${auth.user.id}`, 20, 60_000)
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 32_768) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const mode = body?.mode || 'single'
    const bankroll = body?.bankroll

    if (typeof bankroll !== 'number' || !Number.isFinite(bankroll) || bankroll <= 0 || bankroll > 1_000_000_000) {
      return NextResponse.json({ error: 'A valid bankroll between 0 and 1000000000 is required' }, { status: 400 })
    }

    if (mode === 'portfolio') {
      const { outcomes, correlationMatrix } = body
      if (!Array.isArray(outcomes) || outcomes.length === 0 || outcomes.length > 50) {
        return NextResponse.json({ error: 'outcomes must contain between 1 and 50 entries' }, { status: 400 })
      }
      const validOutcomes = outcomes.every((outcome) =>
        outcome
        && typeof outcome.label === 'string'
        && outcome.label.length <= 100
        && typeof outcome.modelProb === 'number'
        && Number.isFinite(outcome.modelProb)
        && outcome.modelProb >= 0
        && outcome.modelProb <= 1
        && typeof outcome.odds === 'number'
        && Number.isFinite(outcome.odds)
        && outcome.odds > 1
        && outcome.odds <= 1000
      )
      if (!validOutcomes) {
        return NextResponse.json({ error: 'Each outcome requires a label, probability from 0 to 1, and decimal odds above 1' }, { status: 400 })
      }
      const allocation: PortfolioAllocation = calculatePortfolioAllocation(outcomes, bankroll, correlationMatrix)
      return NextResponse.json({ success: true, mode: 'portfolio', data: allocation })
    }

    if (mode !== 'single') {
      return NextResponse.json({ error: 'mode must be single or portfolio' }, { status: 400 })
    }

    // Single bet Kelly calculation
    const { modelProbability, bookmakerOdds, fractionalKelly } = body
    if (modelProbability === undefined || !bookmakerOdds) {
      return NextResponse.json({ error: 'modelProbability and bookmakerOdds are required' }, { status: 400 })
    }
    if (typeof modelProbability !== 'number' || modelProbability < 0.01 || modelProbability > 0.99) {
      return NextResponse.json({ error: 'modelProbability must be between 0.01 and 0.99' }, { status: 400 })
    }
    if (typeof bookmakerOdds !== 'number' || bookmakerOdds <= 1.01) {
      return NextResponse.json({ error: 'bookmakerOdds must be greater than 1.01' }, { status: 400 })
    }
    const result: KellyResult = calculateKelly(
      modelProbability,
      bookmakerOdds,
      bankroll,
      fractionalKelly ?? 0.25
    )

    return NextResponse.json({ success: true, mode: 'single', data: result })
  } catch (error: unknown) {
    console.error('[Kelly] Calculation failed')
    return NextResponse.json({ error: 'Kelly calculation failed' }, { status: 500 })
  }
}