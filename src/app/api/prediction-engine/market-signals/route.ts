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

    const contentLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { openingOdds, currentOdds, matchId, homeTeam, awayTeam } = body || {}

    const validOdds = (odds: any) => odds
      && typeof odds === 'object'
      && ['home', 'draw', 'away'].every((key) =>
        typeof odds[key] === 'number' && Number.isFinite(odds[key]) && odds[key] > 1 && odds[key] <= 1000
      )

    if (typeof homeTeam !== 'string' || !homeTeam.trim() || homeTeam.length > 100
      || typeof awayTeam !== 'string' || !awayTeam.trim() || awayTeam.length > 100
      || !validOdds(openingOdds) || !validOdds(currentOdds)
      || (matchId !== undefined && (typeof matchId !== 'string' || matchId.length > 128))) {
      return NextResponse.json({
        error: 'Valid team names and decimal opening/current odds above 1.0 are required',
      }, { status: 400 })
    }

    const signal: MarketSignal = analyzeMarketSignals(
      openingOdds,
      currentOdds,
      matchId || '',
      homeTeam.trim(),
      awayTeam.trim()
    )

    return NextResponse.json({
      success: true,
      source: 'user-input',
      data: signal,
    })
  } catch (error: unknown) {
    console.error('[Market signals] Calculation failed')
    return NextResponse.json({ error: 'Market signal calculation failed' }, { status: 500 })
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