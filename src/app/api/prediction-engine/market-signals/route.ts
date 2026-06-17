import { NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { analyzeMarketSignals, type MarketSignal } from '@/lib/prediction-engine'

// ── POST /api/prediction-engine/market-signals ─────────────────────────────────
// Analyze market line movements for sharp money detection

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { openingOdds, currentOdds, matchId, homeTeam, awayTeam } = body

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

    return NextResponse.json({ success: true, data: signal })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── GET /api/prediction-engine/market-signals ──────────────────────────────────
// Return explanation of market signal system

export async function GET() {
  return NextResponse.json({
    system: 'ELASTICO Market Signal Tracker',
    description: 'Detects sharp money action and line movement anomalies',
    signals: {
      steamMove: 'Rapid odds movement (>3% change) indicating heavy professional betting volume',
      rlmDetected: 'Reverse Line Movement — odds move AGAINST public betting direction, a strong sharp indicator',
      sharpAction: 'Direction where professional syndicate money is concentrated',
      lineVelocity: 'Speed and magnitude of odds changes, expressed as percentage of opening line',
      confidence: 'Aggregate confidence score (0-100) based on movement magnitude and consistency',
    },
  })
}