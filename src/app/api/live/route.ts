import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  fetchAllLiveScores, fetchLeagueScores, fetchDateScores,
  fetchStandings, fetchLeagueNews, fetchLeagueLeaders,
  fetchInjuries, fetchMatchOdds, fetchWinProbability, fetchPlayByPlay,
  fetchTeams, fetchTeamRoster,
  mapStatus, ESPN_LEAGUES,
} from '@/lib/football-data'
import { fetchStandings as fetchFDStandings } from '@/lib/football-data-org'

import { rateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

/**
 * GET /api/live — Football data (DB-first, ESPN fallback)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`live:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

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
        const season = String(new Date().getFullYear())
        // 1. Try DB first — normalize to canonical shape {team, code, logo}
        const dbStandings = await db.standingEntry.findMany({
          where: { competitionCode: league, season },
          orderBy: { rank: 'asc' },
        })
        if (dbStandings.length > 0) {
          return NextResponse.json({
            success: true, league, source: 'database', count: dbStandings.length,
            data: dbStandings.map(s => ({
              rank: s.rank,
              team: s.teamName,
              code: s.teamCode || '',
              logo: s.teamLogo || '',
              played: s.played, wins: s.wins, draws: s.draws, losses: s.losses,
              goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
              goalDiff: s.goalDiff, points: s.points, form: s.form || '',
            })),
          })
        }
        // 2. Fallback to football-data.org (requires FOOTBALL_DATA_API_KEY)
        if (process.env.FOOTBALL_DATA_API_KEY) {
          try {
            const fdStandings = await fetchFDStandings(league)
            if (fdStandings.length > 0) {
              const totalTable = fdStandings[0]?.table || []
              return NextResponse.json({
                success: true, league, source: 'football-data.org', count: totalTable.length,
                data: totalTable.map(t => ({
                  rank: t.position, team: t.team.name, code: t.team.tla,
                  logo: t.team.crest, played: t.playedGames, wins: t.won, draws: t.draw,
                  losses: t.lost, goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst,
                  goalDiff: t.goalDifference, points: t.points, form: t.form || '',
                })),
              })
            }
          } catch (err) {
            console.warn('[Live/Standings] football-data.org failed:', err)
          }
        }
        // 3. Fallback to ESPN
        const standings = await fetchStandings(league)
        return NextResponse.json({ success: true, league, source: 'espn', count: standings.length, data: standings })
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

      case 'teams': {
        if (!league) return NextResponse.json({ error: 'league required' }, { status: 400 })
        // Try DB first
        const dbTeams = await db.team.findMany({
          where: { leagueCode: league },
          include: { _count: { select: { players: true } } },
          orderBy: { name: 'asc' },
        })
        if (dbTeams.length > 0) {
          return NextResponse.json({ success: true, league, source: 'database', count: dbTeams.length, data: dbTeams })
        }
        const teams = await fetchTeams(league)
        return NextResponse.json({ success: true, league, source: 'espn', count: teams.length, data: teams })
      }

      case 'roster': {
        const team = searchParams.get('team')
        if (!league || !team) return NextResponse.json({ error: 'league and team required' }, { status: 400 })
        const roster = await fetchTeamRoster(league, team)
        return NextResponse.json({ success: true, league, team, count: roster.length, data: roster })
      }

      case 'scores':
      default: {
        // ── DB-first for scores ──────────────────────────────────────
        const now = new Date()
        const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        // Live + halftime matches
        const liveWhere: any = { status: { in: ['live', 'halftime'] } }
        if (league) liveWhere.competitionCode = league

        const liveMatches = await db.match.findMany({
          where: liveWhere,
          include: { homeTeam: true, awayTeam: true, events: { orderBy: { minute: 'asc' } } },
          orderBy: { date: 'desc' },
        })

        // Upcoming (next 24h)
        const upcomingWhere: any = {
          status: 'upcoming',
          date: { gte: last24h, lte: next24h },
        }
        if (league) upcomingWhere.competitionCode = league

        const upcomingMatches = await db.match.findMany({
          where: upcomingWhere,
          include: { homeTeam: true, awayTeam: true },
          orderBy: { date: 'asc' },
        })

        // Recently finished (last 24h)
        const finishedWhere: any = {
          status: 'finished',
          date: { gte: last24h },
        }
        if (league) finishedWhere.competitionCode = league

        const finishedMatches = await db.match.findMany({
          where: finishedWhere,
          include: { homeTeam: true, awayTeam: true },
          orderBy: { date: 'desc' },
        })

        const allDb = [...liveMatches, ...upcomingMatches, ...finishedMatches]

        if (allDb.length > 0) {
          const filtered = status
            ? allDb.filter(m => m.status === status)
            : allDb

          return NextResponse.json({
            success: true,
            source: 'database',
            count: filtered.length,
            liveCount: liveMatches.length,
            upcomingCount: upcomingMatches.length,
            finishedCount: finishedMatches.length,
            leagues: ESPN_LEAGUES.map(l => ({ code: l.code, name: l.name, espnId: l.espnId })),
            matches: filtered.map(m => ({
              id: m.id,
              competition: m.competition,
              competitionCode: m.competitionCode,
              homeTeam: {
                id: m.homeTeam.id,
                name: m.homeTeam.name,
                abbreviation: m.homeTeam.code,
                logo: m.homeTeam.logo,
                color: m.homeTeam.primaryColor,
              },
              awayTeam: {
                id: m.awayTeam.id,
                name: m.awayTeam.name,
                abbreviation: m.awayTeam.code,
                logo: m.awayTeam.logo,
                color: m.awayTeam.primaryColor,
              },
              homeScore: m.homeScore,
              awayScore: m.awayScore,
              status: m.status,
              date: m.date?.toISOString() || null,
              venue: m.venue,
              minute: m.minute,
              events: 'events' in m ? (m as any).events.map((e: any) => ({
                minute: e.minute,
                type: e.type,
                detail: e.detail,
                team: e.team,
                playerName: e.playerName,
              })) : [],
            })),
          })
        }

        // ── Fallback: ESPN ────────────────────────────────────────────
        console.log('[Live] DB empty, falling back to ESPN')
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
          source: 'espn',
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
