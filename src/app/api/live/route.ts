import { NextRequest, NextResponse } from 'next/server'
import {
  fetchAllLiveScores, fetchLeagueScores, fetchDateScores,
  fetchStandings, fetchLeagueNews, fetchLeagueLeaders,
  fetchInjuries, fetchMatchOdds, fetchWinProbability, fetchPlayByPlay,
  mapStatus, ESPN_LEAGUES,
} from '@/lib/football-data'

/**
 * GET /api/live — ESPN-powered football data
 *
 * Query params:
 *   (no params)             — All live scores across 20 leagues
 *   league=PL               — Scores for one league
 *   status=live|upcoming|finished
 *   date=20260618           — Scores for specific date
 *   action=standings&league=PL   — League table
 *   action=news&league=PL        — ESPN league news
 *   action=leaders&league=PL     — Top scorers
 *   action=injuries&league=PL    — Injury report
 *   action=odds&league=PL&event=12345  — Match odds
 *   action=probability&league=PL&event=12345  — Win probability
 *   action=plays&league=PL&event=12345       — Play-by-play
 *   action=leagues               — List all configured leagues
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'scores'
    const league = searchParams.get('league') || undefined
    const status = searchParams.get('status') || undefined
    const date = searchParams.get('date') || undefined
    const event = searchParams.get('event') || undefined

    switch (action) {
      case 'leagues': {
        return NextResponse.json({ success: true, data: ESPN_LEAGUES })
      }

      case 'standings': {
        if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
        const standings = await fetchStandings(league)
        return NextResponse.json({ success: true, league, count: standings.length, data: standings })
      }

      case 'news': {
        if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
        const news = await fetchLeagueNews(league)
        return NextResponse.json({ success: true, league, count: news.length, data: news })
      }

      case 'leaders': {
        if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
        const leaders = await fetchLeagueLeaders(league)
        return NextResponse.json({ success: true, league, count: leaders.length, data: leaders })
      }

      case 'injuries': {
        if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
        const injuries = await fetchInjuries(league)
        return NextResponse.json({ success: true, league, count: injuries.length, data: injuries })
      }

      case 'odds': {
        if (!league || !event) return NextResponse.json({ error: 'league and event required' }, { status: 400 })
        const odds = await fetchMatchOdds(league, event)
        return NextResponse.json({ success: true, data: odds })
      }

      case 'probability': {
        if (!league || !event) return NextResponse.json({ error: 'league and event required' }, { status: 400 })
        const prob = await fetchWinProbability(league, event)
        return NextResponse.json({ success: true, data: prob })
      }

      case 'plays': {
        if (!league || !event) return NextResponse.json({ error: 'league and event required' }, { status: 400 })
        const plays = await fetchPlayByPlay(league, event)
        return NextResponse.json({ success: true, count: plays.length, data: plays })
      }

      case 'scores':
      default: {
        let matches
        if (date) {
          matches = await fetchDateScores(date, league)
        } else if (league) {
          matches = await fetchLeagueScores(league)
        } else {
          matches = await fetchAllLiveScores()
        }

        const filtered = status
          ? matches.filter(m => mapStatus(m.status) === status)
          : matches

        return NextResponse.json({
          success: true,
          count: filtered.length,
          leagues: ESPN_LEAGUES.map(l => ({ code: l.code, name: l.name, espnId: l.espnId })),
          matches: filtered.map(m => ({
            id: m.id,
            competition: m.competition,
            homeTeam: { name: m.homeTeam.name, abbreviation: m.homeTeam.abbreviation, logo: m.homeTeam.logo, color: m.homeTeam.color },
            awayTeam: { name: m.awayTeam.name, abbreviation: m.awayTeam.abbreviation, logo: m.awayTeam.logo, color: m.awayTeam.color },
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            status: mapStatus(m.status),
            date: m.date,
            venue: m.venue,
            minute: m.minute,
          })),
        })
      }
    }
  } catch (error) {
    console.error('[LIVE] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}