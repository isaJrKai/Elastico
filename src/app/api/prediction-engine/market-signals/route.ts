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

    if (!openingOdds || !currentOdds || !homeTeam || !awayTeam) {
      return NextResponse.json({
        error: 'openingOdds, currentOdds, homeTeam, and awayTeam are required'
      }, { status: 400 })
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
// Returns market signal system info + available real odds from football-data.org

export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const hasApiKey = !!process.env.FOOTBALL_DATA_API_KEY

  return NextResponse.json({
    system: 'ELASTICO Market Signal Tracker',
    description: 'Detects sharp money action and line movement anomalies',
    dataSource: hasApiKey ? 'football-data.org (real odds)' : 'user-entered odds',
    signals: {
      steamMove: 'Rapid odds movement (>3% change) indicating heavy professional betting volume',
      rlmDetected: 'Reverse Line Movement — odds move AGAINST public betting direction, a strong sharp indicator',
      sharpAction: 'Direction where professional syndicate money is concentrated',
      lineVelocity: 'Speed and magnitude of odds changes, expressed as percentage of opening line',
      confidence: 'Aggregate confidence score (0-100) based on movement magnitude and consistency',
    },
  })
}