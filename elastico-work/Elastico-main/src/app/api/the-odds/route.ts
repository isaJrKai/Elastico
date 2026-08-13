import { NextRequest, NextResponse } from 'next/server'
import { fetchSoccerOdds, fetchAllSoccerOdds, extractTheOddsData } from '@/lib/the-odds-api'

/**
 * GET /api/the-odds
 *
 * Real bookmaker odds from TheOdds API.
 *   ?league=epl           — Specific league odds
 *   ?all=true             — All soccer odds
 *   ?regions=eu,us,uk     — Bookmaker regions
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league') || undefined
    const all = searchParams.get('all') === 'true'

    if (!process.env.THE_ODDS_API_KEY) {
      return NextResponse.json({
        success: true,
        source: 'none',
        data: [],
        hint: 'Set THE_ODDS_API_KEY for real bookmaker odds',
      })
    }

    let rawOdds
    if (all) {
      rawOdds = await fetchAllSoccerOdds()
    } else {
      rawOdds = await fetchSoccerOdds(league)
    }

    const data = extractTheOddsData(rawOdds)

    return NextResponse.json({
      success: true,
      source: 'the-odds-api.com',
      count: data.length,
      data,
    })
  } catch (error) {
    console.error('[TheOdds] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}