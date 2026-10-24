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

    const rawBody: unknown = await request.json()
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }
    const body = rawBody as Record<string, unknown>
    const mode = body.mode ?? 'single'
    const isFiniteIn = (value: unknown, min: number, max: number): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

    if (mode === 'portfolio') {
      const outcomes = body.outcomes
      const bankroll = body.bankroll ?? 1000
      const correlationMatrix = body.correlationMatrix as number[][] | undefined
      if (!Array.isArray(outcomes) || outcomes.length < 1 || outcomes.length > 20) {
        return NextResponse.json({ error: 'outcomes must be an array containing 1 to 20 items' }, { status: 400 })
      }
      if (!isFiniteIn(bankroll, 1, 1_000_000_000)) {
        return NextResponse.json({ error: 'bankroll must be between 1 and 1000000000' }, { status: 400 })
      }
      for (const [index, item] of outcomes.entries()) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return NextResponse.json({ error: `outcomes[${index}] must be an object` }, { status: 400 })
        }
        const outcome = item as Record<string, unknown>
        if (typeof outcome.label !== 'string' || !outcome.label.trim() || !isFiniteIn(outcome.modelProb, 0, 1) || !isFiniteIn(outcome.odds, 1.01, 1000)) {
          return NextResponse.json({ error: `outcomes[${index}] requires modelProb from 0 to 1 and decimal odds greater than 1.01` }, { status: 400 })
        }
      }
      if (correlationMatrix !== undefined) {
        if (!Array.isArray(correlationMatrix) || correlationMatrix.length !== outcomes.length ||
            correlationMatrix.some((row: unknown) => !Array.isArray(row) || row.length !== outcomes.length ||
              row.some((v: unknown) => !isFiniteIn(v, -1, 1)))) {
          return NextResponse.json({ error: 'correlationMatrix must be a square matrix matching outcomes, with values between -1 and 1' }, { status: 400 })
        }
        for (let i = 0; i < correlationMatrix.length; i++) {
          if (Math.abs(correlationMatrix[i][i] - 1) > 1e-6) {
            return NextResponse.json({ error: 'correlationMatrix diagonal values must equal 1' }, { status: 400 })
          }
          for (let j = i + 1; j < correlationMatrix.length; j++) {
            if (Math.abs(correlationMatrix[i][j] - correlationMatrix[j][i]) > 1e-6) {
              return NextResponse.json({ error: 'correlationMatrix must be symmetric' }, { status: 400 })
            }
          }
        }
      }
      // The core allocator's default matrix is 3x3. For 1-2 outcome portfolios,
      // use an identity matrix unless the caller explicitly supplies correlations.
      const effectiveCorrelationMatrix = correlationMatrix ??
        (outcomes.length === 3 ? undefined : outcomes.map((_: unknown, i: number) =>
          outcomes.map((__: unknown, j: number) => i === j ? 1 : 0)))
      const allocation: PortfolioAllocation = calculatePortfolioAllocation(
        outcomes as { label: string; modelProb: number; odds: number }[],
        bankroll,
        effectiveCorrelationMatrix
      )
      return NextResponse.json({ success: true, mode: 'portfolio', data: allocation })
    }

    if (mode !== 'single') {
      return NextResponse.json({ error: 'mode must be single or portfolio' }, { status: 400 })
    }
    const { modelProbability, bookmakerOdds } = body
    const bankroll = body.bankroll ?? 1000
    const fractionalKelly = body.fractionalKelly ?? 0.25
    if (!isFiniteIn(modelProbability, 0.01, 0.99)) {
      return NextResponse.json({ error: 'modelProbability must be between 0.01 and 0.99' }, { status: 400 })
    }
    if (!isFiniteIn(bookmakerOdds, 1.01, 1000)) {
      return NextResponse.json({ error: 'bookmakerOdds must be greater than 1.01 and no greater than 1000' }, { status: 400 })
    }
    if (!isFiniteIn(bankroll, 1, 1_000_000_000)) {
      return NextResponse.json({ error: 'bankroll must be between 1 and 1000000000' }, { status: 400 })
    }
    if (!isFiniteIn(fractionalKelly, 0, 1)) {
      return NextResponse.json({ error: 'fractionalKelly must be between 0 and 1' }, { status: 400 })
    }

    const result: KellyResult = calculateKelly(
      modelProbability,
      bookmakerOdds,
      bankroll,
      fractionalKelly
    )

    return NextResponse.json({ success: true, mode: 'single', data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}