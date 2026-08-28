import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchStandings as fetchASStandings, AS_LEAGUES } from '@/lib/api-sports'
import { fetchStandings as fetchFDStandings } from '@/lib/football-data-org'
import { fetchStandings as fetchESPNStandings } from '@/lib/football-data'

import { rateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

/** Dynamic season: Aug+ = current year, else previous year */
function getSeason(): string {
  const now = new Date()
  return String(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1)
}

export async function GET(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`standings:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'
    const season = searchParams.get('season') || getSeason()

    // ── Try database first (use requested season or dynamic) ──
    const dbSeason = season
    const dbStandings = await db.standingEntry.findMany({
      where: {
        competitionCode: competition,
        season: dbSeason,
      },
      orderBy: { rank: 'asc' },
    })

    // Only use DB data if it looks valid (has proper ranks and reasonable team count)
    const dbValid = dbStandings.length > 0 && dbStandings[0].rank > 0

    if (dbValid) {
      return NextResponse.json({
        success: true,
        source: 'database',
        competition,
        season: dbSeason,
        standings: dbStandings.map(s => ({
          rank: s.rank,
          team: s.teamName,
          code: s.teamCode || '',
          logo: s.teamLogo || '',
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalDiff,
          points: s.points,
          form: s.form || '',
        })),
      })
    }

    // ── Fallback 1: API-Sports (highest quality, free tier) ────────────
    const leagueConfig = AS_LEAGUES.find(l => l.code === competition)
    if (leagueConfig) {
      try {
        const seasonNum = parseInt(season)
        const standingsGroups = await fetchASStandings(leagueConfig.id, seasonNum)
        const allEntries = standingsGroups.flat()
        if (allEntries.length > 0) {
          return NextResponse.json({
            success: true,
            source: 'api-sports',
            competition,
            season: season,
            standings: allEntries.map(e => ({
              rank: e.rank,
              team: e.team.name,
              code: '',
              logo: e.team.logo || '',
              played: e.all.played,
              wins: e.all.win,
              draws: e.all.draw,
              losses: e.all.lose,
              goalsFor: e.all.goals.for,
              goalsAgainst: e.all.goals.against,
              goalDiff: e.goalsDiff,
              points: e.points,
              form: e.form || '',
            })),
          })
        }
      } catch (err) {
        console.warn('[Standings] API-Sports failed:', err)
      }
    }

    // ── Fallback 2: football-data.org ───────────────────────────────────
    if (process.env.FOOTBALL_DATA_API_KEY) {
      try {
        const standings = await fetchFDStandings(competition)
        if (standings.length > 0) {
          const totalTable = standings[0]?.table || []
          return NextResponse.json({
            success: true,
            source: 'football-data.org',
            competition,
            season: season,
            standings: totalTable.map(t => ({
              rank: t.position,
              team: t.team.name,
              code: t.team.tla,
              logo: t.team.crest,
              played: t.playedGames,
              wins: t.won,
              draws: t.draw,
              losses: t.lost,
              goalsFor: t.goalsFor,
              goalsAgainst: t.goalsAgainst,
              goalDiff: t.goalDifference,
              points: t.points,
              form: t.form || '',
            })),
          })
        }
      } catch (err) {
        console.warn('[Standings] football-data.org failed:', err)
      }
    }

    // ── Fallback 3: ESPN ────────────────────────────────────────────────
    const espnStandings = await fetchESPNStandings(competition)
    if (espnStandings.length > 0) {
      return NextResponse.json({
        success: true,
        source: 'espn',
        competition,
        season: season,
        standings: espnStandings.map(s => ({
          rank: s.rank,
          team: s.team,
          code: s.code,
          logo: s.logo,
          played: s.played,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalDiff: s.goalDiff,
          points: s.points,
          form: s.form,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      source: 'none',
      competition,
      season: season,
      standings: [],
    })
  } catch (error) {
    console.error('[Standings] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
