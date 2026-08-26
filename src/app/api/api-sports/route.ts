import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  fetchFixtures, fetchLiveFixtures, fetchTodayFixtures, fetchStandings,
  fetchTopScorers, fetchHeadToHead, fetchOdds, fetchLeagueOdds,
  fetchInjuries, fetchPrediction, normalizeASFixture, extractASOdds,
  AS_LEAGUES,
} from '@/lib/api-sports'

/**
 * GET /api/api-sports
 *
 * Unified API-Sports endpoint:
 *   action=fixtures&league=39          — League fixtures
 *   action=live                        — All live fixtures
 *   action=today                       — Today's fixtures
 *   action=standings&league=39         — League standings
 *   action=scorers&league=39           — Top scorers
 *   action=prediction&fixture=12345    — Match prediction
 *   action=odds&fixture=12345          — Fixture odds
 *   action=league-odds&league=39       — All odds for a league
 *   action=h2h&teams=40-42             — Head to head
 *   action=injuries&league=39          — Injuries
 *   action=leagues                     — List configured leagues
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`api-sports:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'today'

    if (!process.env.API_SPORTS_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API_SPORTS_KEY not configured',
        hint: 'Add your API-Sports key at Vercel > Settings > Environment Variables',
      }, { status: 503 })
    }

    switch (action) {
      case 'leagues': {
        return NextResponse.json({ success: true, action, data: AS_LEAGUES })
      }

      case 'fixtures': {
        const leagueId = parseInt(searchParams.get('league') || '39')
        const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined
        const fixtures = await fetchFixtures(leagueId, season)
        return NextResponse.json({
          success: true, action, count: fixtures.length,
          data: fixtures.map(normalizeASFixture),
        })
      }

      case 'live': {
        const fixtures = await fetchLiveFixtures()
        return NextResponse.json({
          success: true, action, count: fixtures.length,
          data: fixtures.map(normalizeASFixture),
        })
      }

      case 'today': {
        const fixtures = await fetchTodayFixtures()
        return NextResponse.json({
          success: true, action, count: fixtures.length,
          data: fixtures.map(normalizeASFixture),
        })
      }

      case 'standings': {
        const leagueId = parseInt(searchParams.get('league') || '39')
        const standings = await fetchStandings(leagueId)
        const flat = standings.flat()
        return NextResponse.json({
          success: true, action, count: flat.length, data: flat,
        })
      }

      case 'scorers': {
        const leagueId = parseInt(searchParams.get('league') || '39')
        const scorers = await fetchTopScorers(leagueId)
        return NextResponse.json({
          success: true, action, count: scorers.length, data: scorers,
        })
      }

      case 'prediction': {
        const fixtureId = parseInt(searchParams.get('fixture') || '0')
        if (!fixtureId) return NextResponse.json({ error: 'fixture param required' }, { status: 400 })
        const prediction = await fetchPrediction(fixtureId)
        return NextResponse.json({ success: true, action, data: prediction })
      }

      case 'odds': {
        const fixtureId = parseInt(searchParams.get('fixture') || '0')
        if (!fixtureId) return NextResponse.json({ error: 'fixture param required' }, { status: 400 })
        const odds = await fetchOdds(fixtureId)
        if (!odds) return NextResponse.json({ success: true, action, data: null })
        return NextResponse.json({
          success: true, action,
          data: { fixture: odds.fixture, extracted: extractASOdds(odds) },
        })
      }

      case 'league-odds': {
        const leagueId = parseInt(searchParams.get('league') || '39')
        const odds = await fetchLeagueOdds(leagueId)
        return NextResponse.json({
          success: true, action, count: odds.length,
          data: odds.map(o => ({ fixture: o.fixture, extracted: extractASOdds(o) })),
        })
      }

      case 'h2h': {
        const teams = searchParams.get('teams') || ''
        if (!teams) return NextResponse.json({ error: 'teams param required (e.g. 40-42)' }, { status: 400 })
        const h2h = await fetchHeadToHead(teams)
        return NextResponse.json({ success: true, action, count: h2h.length, data: h2h })
      }

      case 'injuries': {
        const leagueId = parseInt(searchParams.get('league') || '39')
        const injuries = await fetchInjuries(leagueId)
        return NextResponse.json({ success: true, action, count: injuries.length, data: injuries })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('[API-Sports] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}