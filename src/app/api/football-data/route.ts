import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  fetchStandings, fetchMatches, fetchTodaysMatches, fetchScorers,
  fetchCompetitions, fetchMatchesWithOdds, normalizeFDMatch,
  FD_COMPETITIONS,
} from '@/lib/football-data-org'

/**
 * GET /api/football-data
 *
 * DATA FLOW: API Key -> DB (StandingEntry, Match, Team, OddsSnapshot) -> App
 *
 * Query params:
 *   action=standings&competition=PL    — League table (persisted to StandingEntry)
 *   action=matches&competition=PL      — Competition matches (persisted to Match)
 *   action=today                       — All today's matches (persisted to Match)
 *   action=scorers&competition=PL      — Top scorers
 *   action=competitions                — List all available competitions
 *   action=odds&competition=PL         — Matches with odds (persisted to OddsSnapshot)
 *
 * ?refresh=true — Force fresh API call even if DB has data
 */

export const dynamic = 'force-dynamic'

// ── Persist standings to DB ─────────────────────────────────────────────
async function persistStandings(competitionCode: string): Promise<any[]> {
  const standings = await fetchStandings(competitionCode)
  if (!standings.length) return []

  const table = standings[0]?.table || []
  const season = String(new Date().getFullYear())
  const compEntry = FD_COMPETITIONS.find(c => c.code === competitionCode)
  const compName = compEntry?.name || competitionCode

  for (const entry of table) {
    try {
      await db.standingEntry.upsert({
        where: {
          competitionCode_season_teamName: {
            competitionCode,
            season,
            teamName: entry.team.name,
          },
        },
        update: {
          teamCode: entry.team.tla,
          teamLogo: entry.team.crest,
          competition: compName,
          rank: entry.position,
          played: entry.playedGames,
          wins: entry.won,
          draws: entry.draw,
          losses: entry.lost,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
          goalDiff: entry.goalDifference,
          points: entry.points,
          form: entry.form || null,
          source: 'football-data.org',
          lastSyncedAt: new Date(),
        },
        create: {
          teamName: entry.team.name,
          teamCode: entry.team.tla,
          teamLogo: entry.team.crest,
          competition: compName,
          competitionCode,
          season,
          rank: entry.position,
          played: entry.playedGames,
          wins: entry.won,
          draws: entry.draw,
          losses: entry.lost,
          goalsFor: entry.goalsFor,
          goalsAgainst: entry.goalsAgainst,
          goalDiff: entry.goalDifference,
          points: entry.points,
          form: entry.form || null,
          source: 'football-data.org',
        },
      })
    } catch (err) {
      console.warn(`[FD/DB] Standings upsert failed for ${entry.team.name}:`, err)
    }
  }

  console.log(`[FD/DB] Persisted ${table.length} standings for ${competitionCode}`)
  return table
}

// ── Persist matches to DB ───────────────────────────────────────────────
async function persistMatches(matches: any[], competitionCode: string): Promise<number> {
  let saved = 0
  const season = String(new Date().getFullYear())

  for (const m of matches) {
    try {
      // Upsert home team
      const homeTeam = await db.team.upsert({
        where: { source_sourceId: { source: 'football-data.org', sourceId: String(m.homeTeam?.id || '') } },
        update: { name: m.homeTeam?.name, logo: m.homeTeam?.crest, lastSyncedAt: new Date() },
        create: {
          externalId: String(m.homeTeam?.id || ''),
          name: m.homeTeam?.name || 'Unknown',
          code: m.homeTeam?.tla || '???',
          logo: m.homeTeam?.crest || '',
          league: m.competition?.name || '',
          leagueCode: competitionCode,
          source: 'football-data.org',
          sourceId: String(m.homeTeam?.id || ''),
        },
      })

      // Upsert away team
      const awayTeam = await db.team.upsert({
        where: { source_sourceId: { source: 'football-data.org', sourceId: String(m.awayTeam?.id || '') } },
        update: { name: m.awayTeam?.name, logo: m.awayTeam?.crest, lastSyncedAt: new Date() },
        create: {
          externalId: String(m.awayTeam?.id || ''),
          name: m.awayTeam?.name || 'Unknown',
          code: m.awayTeam?.tla || '???',
          logo: m.awayTeam?.crest || '',
          league: m.competition?.name || '',
          leagueCode: competitionCode,
          source: 'football-data.org',
          sourceId: String(m.awayTeam?.id || ''),
        },
      })

      // Upsert match
      await db.match.upsert({
        where: { source_sourceId: { source: 'football-data.org', sourceId: String(m.id) } },
        update: {
          homeScore: m.score?.fullTime?.home ?? 0,
          awayScore: m.score?.fullTime?.away ?? 0,
          halfTimeHome: m.score?.halfTime?.home ?? null,
          halfTimeAway: m.score?.halfTime?.away ?? null,
          status: mapFDStatusToInternal(m.status),
          lastSyncedAt: new Date(),
        },
        create: {
          externalId: String(m.id),
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          competition: m.competition?.name || '',
          competitionCode,
          season,
          date: m.utcDate ? new Date(m.utcDate) : null,
          status: mapFDStatusToInternal(m.status),
          homeScore: m.score?.fullTime?.home ?? 0,
          awayScore: m.score?.fullTime?.away ?? 0,
          halfTimeHome: m.score?.halfTime?.home ?? null,
          halfTimeAway: m.score?.halfTime?.away ?? null,
          source: 'football-data.org',
          sourceId: String(m.id),
        },
      })
      saved++
    } catch (err) {
      console.warn(`[FD/DB] Match upsert failed for ${m.id}:`, err)
    }
  }

  console.log(`[FD/DB] Persisted ${saved} matches for ${competitionCode}`)
  return saved
}

function mapFDStatusToInternal(status: string): string {
  const map: Record<string, string> = {
    'SCHEDULED': 'upcoming', 'TIMED': 'upcoming', 'IN_PLAY': 'live',
    'PAUSED': 'halftime', 'FINISHED': 'finished', 'POSTPONED': 'postponed',
    'CANCELLED': 'postponed', 'SUSPENDED': 'postponed',
  }
  return map[status] || 'upcoming'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'today'
    const competition = searchParams.get('competition') || 'PL'
    const refresh = searchParams.get('refresh') === 'true'
    const season = String(new Date().getFullYear())

    if (!process.env.FOOTBALL_DATA_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'FOOTBALL_DATA_API_KEY not configured',
        hint: 'Add your key to .env',
      }, { status: 503 })
    }

    switch (action) {
      case 'competitions': {
        // Competitions are metadata, serve directly (small, rarely changes)
        const comps = await fetchCompetitions()
        return NextResponse.json({ success: true, action, data: comps })
      }

      case 'standings': {
        // Try DB first
        if (!refresh) {
          const dbStandings = await db.standingEntry.findMany({
            where: { competitionCode: competition, season, source: 'football-data.org' },
            orderBy: { rank: 'asc' },
          })
          if (dbStandings.length > 0) {
            return NextResponse.json({
              success: true, action, competition, source: 'database',
              data: dbStandings.map(s => ({
                position: s.rank, team: s.teamName, code: s.teamCode,
                crest: s.teamLogo, played: s.played, won: s.wins,
                drawn: s.draws, lost: s.losses, goalsFor: s.goalsFor,
                goalsAgainst: s.goalsAgainst, goalDifference: s.goalDiff,
                points: s.points, form: s.form || '',
              })),
            })
          }
        }
        // Fetch from API and persist
        const table = await persistStandings(competition)
        return NextResponse.json({
          success: true, action, competition, source: 'database (refreshed)',
          data: table.map((t: any) => ({
            position: t.position, team: t.team.name, code: t.team.tla,
            crest: t.team.crest, played: t.playedGames, won: t.won,
            drawn: t.draw, lost: t.lost, goalsFor: t.goalsFor,
            goalsAgainst: t.goalsAgainst, goalDifference: t.goalDifference,
            points: t.points, form: t.form || '',
          })),
        })
      }

      case 'matches': {
        const matchday = searchParams.get('matchday') ? parseInt(searchParams.get('matchday')!) : undefined
        const status = searchParams.get('status') || undefined

        // Try DB first
        if (!refresh) {
          const where: any = { competitionCode: competition, source: 'football-data.org' }
          if (status) {
            // Handle comma-separated statuses like "SCHEDULED,TIMED"
            const statuses = status.split(',').map(s => mapFDStatusToInternal(s.trim()))
            where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
          }
          const dbMatches = await db.match.findMany({
            where,
            include: { homeTeam: true, awayTeam: true, events: true },
            orderBy: { date: 'asc' },
            take: 100,
          })
          if (dbMatches.length > 0) {
            return NextResponse.json({
              success: true, action, competition, source: 'database', count: dbMatches.length,
              data: dbMatches.map(m => ({
                id: `fd:${m.externalId}`,
                competition: m.competition, competitionCode: m.competitionCode,
                homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, abbreviation: m.homeTeam.code, logo: m.homeTeam.logo, color: '#fff' },
                awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, abbreviation: m.awayTeam.code, logo: m.awayTeam.logo, color: '#fff' },
                homeScore: m.homeScore, awayScore: m.awayScore,
                halfTimeHome: m.halfTimeHome, halfTimeAway: m.halfTimeAway,
                status: m.status, date: m.date?.toISOString() || null,
                matchday: m.round, events: m.events,
                source: 'database',
              })),
            })
          }
        }

        // Fetch from API and persist
        const matches = await fetchMatches(competition, matchday, status)
        await persistMatches(matches, competition)
        return NextResponse.json({
          success: true, action, competition, count: matches.length,
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
        // Persist to OddsSnapshot
        const now = new Date()
        for (const m of matches) {
          if (!m.odds?.matchWinner) continue
          try {
            await db.oddsSnapshot.create({
              data: {
                externalId: String(m.id),
                source: 'football-data.org',
                sportKey: `soccer_${competition.toLowerCase()}`,
                homeTeam: m.homeTeam?.name || '',
                awayTeam: m.awayTeam?.name || '',
                commenceTime: m.utcDate ? new Date(m.utcDate) : null,
                homeWinOdds: parseFloat(m.odds.matchWinner.home) || null,
                drawOdds: parseFloat(m.odds.matchWinner.draw) || null,
                awayWinOdds: parseFloat(m.odds.matchWinner.away) || null,
                bookmaker: 'football-data.org aggregate',
                fetchedAt: now,
              },
            })
          } catch { /* duplicate */ }
        }
        return NextResponse.json({
          success: true, action, competition, count: matches.length,
          data: matches.map(normalizeFDMatch),
        })
      }

      case 'today':
      default: {
        // Try DB first
        if (!refresh) {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)

          const dbMatches = await db.match.findMany({
            where: {
              date: { gte: today, lt: tomorrow },
              source: 'football-data.org',
            },
            include: { homeTeam: true, awayTeam: true, events: true },
            orderBy: { date: 'asc' },
            take: 100,
          })

          if (dbMatches.length > 0) {
            return NextResponse.json({
              success: true, action: 'today', source: 'database', count: dbMatches.length,
              data: dbMatches.map(m => ({
                id: `fd:${m.externalId}`,
                competition: m.competition, competitionCode: m.competitionCode,
                homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, abbreviation: m.homeTeam.code, logo: m.homeTeam.logo, color: '#fff' },
                awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, abbreviation: m.awayTeam.code, logo: m.awayTeam.logo, color: '#fff' },
                homeScore: m.homeScore, awayScore: m.awayScore,
                status: m.status, date: m.date?.toISOString() || null,
                source: 'database',
              })),
            })
          }
        }

        // Fetch from API and persist
        const matches = await fetchTodaysMatches()
        await persistMatches(matches, 'ALL')
        return NextResponse.json({
          success: true, action: 'today', count: matches.length,
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