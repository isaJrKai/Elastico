import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { analyzeMarketSignals, type MarketSignal } from '@/lib/prediction-engine'
import { rateLimit } from '@/lib/rate-limit'

// ── POST /api/prediction-engine/market-signals ─────────────────────────────────
// Analyze market line movements for sharp money detection.
// Accepts real odds from football-data.org or user-entered odds.

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const identifier = auth.user.id
    const rl = rateLimit(`market-signals:${identifier}`, 20)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const body = await request.json()
    const { openingOdds, currentOdds, matchId, homeTeam, awayTeam, source } = body

    if (!openingOdds || !currentOdds || typeof homeTeam !== 'string' || !homeTeam.trim()
      || typeof awayTeam !== 'string' || !awayTeam.trim()) {
      return NextResponse.json({
        error: 'openingOdds, currentOdds, homeTeam, and awayTeam are required'
      }, { status: 400 })
    }
    const validOdds = (value: unknown): value is { home: number; draw: number; away: number } =>
      Boolean(value && typeof value === 'object'
        && ['home', 'draw', 'away'].every(key => {
          const odd = (value as Record<string, unknown>)[key]
          return typeof odd === 'number' && Number.isFinite(odd) && odd > 1.01 && odd <= 1000
        }))
    if (!validOdds(openingOdds) || !validOdds(currentOdds)) {
      return NextResponse.json({ error: 'Opening and current odds must contain finite decimal odds > 1.01 and <= 1000 for home, draw, and away' }, { status: 400 })
    }

    const signal: MarketSignal = analyzeMarketSignals(
      openingOdds,
      currentOdds,
      matchId || '',
      homeTeam,
      awayTeam
    )

    return NextResponse.json({
      success: true,
      source: source || 'user-input',
      data: signal,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── GET /api/prediction-engine/market-signals ──────────────────────────────────
// Returns market signal system information; this endpoint analyzes odds supplied by the user.

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  return NextResponse.json({
    system: 'ELASTICO Market Signal Tracker',
    description: 'Summarizes observed odds movement; it does not infer professional betting activity',
    dataSource: 'user-entered opening/current odds',
    signals: {
      steamMove: 'Rapid odds movement (>3% change); movement alone does not establish betting volume or cause',
      opposingMoveDetected: 'Home and away odds moved in opposite directions; public betting data is not available, so this is not a verified reverse-line-movement signal',
      largestMove: 'Side with the largest absolute odds movement; this does not identify professional bettors',
      lineVelocity: 'Speed and magnitude of odds changes, expressed as percentage of opening line',
      movementStrength: 'Heuristic score from 0 to 100 based only on observed odds movement; not a calibrated prediction confidence',
    },
  })
}