import { NextRequest, NextResponse } from 'next/server'
import {
  fetchStandings, fetchMatches, fetchTodaysMatches, fetchScorers,
  fetchCompetitions, fetchMatchesWithOdds, normalizeFDMatch
} from '@/lib/football-data-org'

/**
 * GET /api/football-data
 * Unified endpoint for football-data.org data
 * 
 * Query params:
 *   action=standings&competition=PL    — League table
 *   action=matches&competition=PL      — Competition matches (current matchday)
 *   action=today                       — All today's matches
 *   action=scorers&competition=PL      — Top scorers
 *   action=competitions                — List all available competitions
 *   action=odds&competition=PL         — Matches with odds data
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'today'
    const competition = searchParams.get('competition') || 'PL'

    if (!process.env.FOOTBALL_DATA_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'FOOTBALL_DATA_API_KEY not configured',
        hint: 'Add your key at Vercel > Settings > Environment Variables',
      }, { status: 503 })
    }

    switch (action) {
      case 'competitions': {
        const comps = await fetchCompetitions()
        return NextResponse.json({ success: true, action, data: comps })
      }

      case 'standings': {
        const standings = await fetchStandings(competition)
        return NextResponse.json({ success: true, action, competition, data: standings })
      }

      case 'matches': {
        const matchday = searchParams.get('matchday')
          ? parseInt(searchParams.get('matchday')!)
          : undefined
        const status = searchParams.get('status') || undefined
        const matches = await fetchMatches(competition, matchday, status)
        return NextResponse.json({
          success: true,
          action,
          competition,
          count: matches.length,
          data: matches.map(normalizeFDMatch),
        })
      }

      case 'scorers': {
        const limit = parseInt(searchParams.get('limit') || '10')
        const scorers = await fetchScorers(competition, limit)
        return NextResponse.json({ success: true, action, competition, data: scorers })
      }

      case 'odds': {
        const matches = await fetchMatchesWithOdds(competition)
        return NextResponse.json({
          success: true,
          action,
          competition,
          count: matches.length,
          data: matches.map(normalizeFDMatch),
        })
      }

      case 'today':
      default: {
        const matches = await fetchTodaysMatches()
        return NextResponse.json({
          success: true,
          action: 'today',
          count: matches.length,
          data: matches.map(normalizeFDMatch),
        })
      }
    }
  } catch (error) {
    console.error('[football-data] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}