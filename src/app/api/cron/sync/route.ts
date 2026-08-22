import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ESPN_LEAGUES,
  fetchStandings as fetchESPNStandings,
  mapStatus,
} from '@/lib/football-data'
import {
  fetchLiveFixtures,
  fetchFixtures,
  fetchStandings as fetchASStandings,
  fetchTopScorers,
  fetchLeagueTeams,
  fetchSquad,
  mapASStatus,
  AS_LEAGUES,
  type ASFixture,
  AS_LEAGUES as AS_LEAGUES_ARR,
  type ASStandingTeam,
  type ASTeamInfo,
 type ASTopScorer,
  type ASPlayer,
} from '@/lib/api-sports'
import { fetchLeagueTeams as fetchUnderstatLeagueTeams } from '@/lib/understat'
import { resolveUnderstatTeams } from '@/lib/entity-resolution'

export const maxDuration = 25 // Vercel hobby limit safety margin

const SYNC_START = Date.now()
const TIMEOUT_MS = 23_000 // Stop early if approaching Vercel 30s limit

function elapsed() {
  return Date.now() - SYNC_START
}

function checkTimeout() {
  if (elapsed() > TIMEOUT_MS) {
    throw new Error('approaching Vercel timeout, stopping early')
  }
}

// ── Cron Secret Validation ──────────────────────────────────────────────────

function validateCron(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET || 'elastico-cron-2024'
  return secret === expected
}

// ═══════════════════════════════════════════════════════════════════════════════
// API-SPORTS SYNC — Primary data source (high quality, 100 req/day free)
// ═══════════════════════════════════════════════════════════════════════════════

async function syncFixturesFromApiSports(): Promise<{
  created: number
  updated: number
  processed: number
}> {
  const result = { created: 0, updated: 0, processed: 0 }

  try {
    // 1. Live fixtures (1 API call — covers all leagues)
    const liveFixtures = await fetchLiveFixtures()
    console.log(`[SYNC/API-Sports] Got ${liveFixtures.length} live fixtures`)

    for (const f of liveFixtures) {
      checkTimeout()
      await upsertApiSportsFixture(f, result)
    }

    // 2. Today's fixtures from top 5 leagues (5 API calls)
    const top5 = AS_LEAGUES.slice(0, 5) // PL, LIGA, SA, BL, L1
    for (const league of top5) {
      checkTimeout()
      try {
        const fixtures = await fetchFixtures(league.id)
        for (const f of fixtures) {
          checkTimeout()
          await upsertApiSportsFixture(f, result)
        }
      } catch (err: any) {
        if (err.message?.includes('timeout')) throw err
        console.warn(`[SYNC/API-Sports] Failed fixtures for ${league.code}:`, err.message)
      }
    }
  } catch (err: any) {
    if (err.message?.includes('timeout')) throw err
    console.warn('[SYNC/API-Sports] Fixtures failed:', err.message || err)
  }

  return result
}

async function upsertApiSportsFixture(
  f: ASFixture,
  result: { created: number; updated: number; processed: number }
) {
  result.processed++
  const season = String(f.league?.season || new Date().getFullYear())
  const leagueCode =
    AS_LEAGUES.find(l => l.id === f.league?.id)?.code ||
    f.league?.country?.substring(0, 4).toUpperCase() ||
    'UNKNOWN'

  // Upsert home team
  const homeTeam = await db.team.upsert({
    where: { source_sourceId: { source: 'api-sports', sourceId: String(f.teams.home.id) } },
    update: {
      name: f.teams.home.name,
      logo: f.teams.home.logo,
      league: f.league?.name || '',
      leagueCode,
      source: 'api-sports',
      lastSyncedAt: new Date(),
    },
    create: {
      externalId: String(f.teams.home.id),
      name: f.teams.home.name,
      code: f.teams.home.name.substring(0, 3).toUpperCase(),
      logo: f.teams.home.logo,
      league: f.league?.name || '',
      leagueCode,
      country: f.league?.country || '',
      source: 'api-sports',
      sourceId: String(f.teams.home.id),
    },
  })

  // Upsert away team
  const awayTeam = await db.team.upsert({
    where: { source_sourceId: { source: 'api-sports', sourceId: String(f.teams.away.id) } },
    update: {
      name: f.teams.away.name,
      logo: f.teams.away.logo,
      league: f.league?.name || '',
      leagueCode,
      source: 'api-sports',
      lastSyncedAt: new Date(),
    },
    create: {
      externalId: String(f.teams.away.id),
      name: f.teams.away.name,
      code: f.teams.away.name.substring(0, 3).toUpperCase(),
      logo: f.teams.away.logo,
      league: f.league?.name || '',
      leagueCode,
      country: f.league?.country || '',
      source: 'api-sports',
      sourceId: String(f.teams.away.id),
    },
  })

  // Upsert match
  const matchData = {
    externalId: String(f.id),
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competition: f.league?.name || '',
    competitionCode: leagueCode,
    season,
    round: f.league?.round || null,
    date: new Date(f.date),
    status: mapASStatus(f.status?.short || 'NS'),
    minute: f.status?.elapsed ?? null,
    venue: null as string | null,
    homeScore: f.goals?.home ?? 0,
    awayScore: f.goals?.away ?? 0,
    halfTimeHome: f.score?.halftime?.home ?? null,
    halfTimeAway: f.score?.halftime?.away ?? null,
    source: 'api-sports',
    sourceId: String(f.id),
    lastSyncedAt: new Date(),
  }

  try {
    await db.match.upsert({
      where: { source_sourceId: { source: 'api-sports', sourceId: String(f.id) } },
      update: matchData,
      create: matchData,
    })
    result.created++
  } catch {
    result.updated++
  }
}

// ── API-Sports Standings Sync ──────────────────────────────────────────────

async function syncStandingsFromApiSports(): Promise<{
  created: number
  updated: number
}> {
  const result = { created: 0, updated: 0 }
  // Free plan covers 2022-2024; 2024 = 2024/25 completed season
  const season = '2024'
  const topLeagues = AS_LEAGUES.slice(0, 10) // sync top 10 leagues

  for (const league of topLeagues) {
    checkTimeout()
    try {
      const standingsGroups = await fetchASStandings(league.id, 2024)
      for (const group of standingsGroups) {
        for (const entry of group) {
          checkTimeout()
          try {
            await db.standingEntry.upsert({
              where: {
                competitionCode_season_teamName: {
                  competitionCode: league.code,
                  season,
                  teamName: entry.team.name,
                },
              },
              update: {
                teamLogo: entry.team.logo,
                competition: league.name,
                rank: entry.rank,
                played: entry.all.played,
                wins: entry.all.win,
                draws: entry.all.draw,
                losses: entry.all.lose,
                goalsFor: entry.all.goals.for,
                goalsAgainst: entry.all.goals.against,
                goalDiff: entry.goalsDiff,
                points: entry.points,
                form: entry.form || null,
                homeRecord: `${entry.home.win}-${entry.home.draw}-${entry.home.lose}`,
                source: 'api-sports',
                lastSyncedAt: new Date(),
              },
              create: {
                teamName: entry.team.name,
                teamLogo: entry.team.logo,
                competition: league.name,
                competitionCode: league.code,
                season,
                rank: entry.rank,
                played: entry.all.played,
                wins: entry.all.win,
                draws: entry.all.draw,
                losses: entry.all.lose,
                goalsFor: entry.all.goals.for,
                goalsAgainst: entry.all.goals.against,
                goalDiff: entry.goalsDiff,
                points: entry.points,
                form: entry.form || null,
                homeRecord: `${entry.home.win}-${entry.home.draw}-${entry.home.lose}`,
                source: 'api-sports',
              },
            })
            result.created++
          } catch {
            result.updated++
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) throw err
      console.warn(`[SYNC/API-Sports] Standings failed for ${league.code}:`, err.message)
    }
  }

  return result
}

// ═════════════════════════════════════════════════════════════════════════
// UNDERSTAT ANALYTICAL ENRICHMENT (Phase 1: team xG/xGA only)
// Runs AFTER API-Sports sync so that canonical teams exist in DB.
// ═════════════════════════════════════════════════════════════════════════

const UNDERSTAT_LEAGUES = ['PL', 'LIGA', 'SA', 'BL', 'L1'] as const
const UNDERSTAT_SEASON = '2024' // Understat uses calendar year for 24/25 season

async function syncUnderstatAnalytics(): Promise<{
  resolved: number
  unresolved: number
  updated: number
}> {
  const result = { resolved: 0, unresolved: 0, updated: 0 }

  for (const leagueCode of UNDERSTAT_LEAGUES) {
    checkTimeout()
    try {
      const understatTeams = await fetchUnderstatLeagueTeams(leagueCode, parseInt(UNDERSTAT_SEASON))
      if (understatTeams.length === 0) continue

      const { resolved, unresolved } = await resolveUnderstatTeams(
        db, understatTeams, leagueCode, UNDERSTAT_SEASON,
      )

      result.resolved += resolved.length
      result.unresolved += unresolved.length

      // Upsert resolved teams' analytics
      for (const r of resolved) {
        checkTimeout()
        try {
          const ut = understatTeams.find(t => t.id === r.understatTeamId)
          if (!ut) continue

          // Validate: xG must be non-negative
          const xg = parseFloat(String(ut.xG)) || 0
          const xga = parseFloat(String(ut.xGA)) || 0
          const npxg = parseFloat(String(ut.npxG)) || 0
          const npxga = parseFloat(String(ut.npxGA)) || 0
          if (xg < 0 || xga < 0 || npxg < 0 || npxga < 0) {
            console.warn(`[SYNC/Understat] Invalid xG values for ${r.matchedDbTeamName}: xG=${xg}, xGA=${xga}`)
            continue
          }

          // Calculate per-game values (Understat xG is season total)
          const matchesPlayed = (ut.wins || 0) + (ut.draws || 0) + (ut.losses || 0)
          const xgPerGame = matchesPlayed > 0 ? Math.round((xg / matchesPlayed) * 100) / 100 : null
          const xgaPerGame = matchesPlayed > 0 ? Math.round((xga / matchesPlayed) * 100) / 100 : null
          const ppda = ut.ppda?.def > 0 ? Math.round((ut.ppda.att / ut.ppda.def) * 100) / 100 : null
          const deep = matchesPlayed > 0 ? Math.round((ut.deep / matchesPlayed) * 100) / 100 : null
          const ppdaAllowed = ut.ppda_allowed?.def > 0
            ? Math.round((ut.ppda_allowed.att / ut.ppda_allowed.def) * 100) / 100
            : null
          const deepAllowed = matchesPlayed > 0
            ? Math.round((ut.deep_allowed / matchesPlayed) * 100) / 100
            : null

          await db.teamAnalytic.upsert({
            where: {
              teamId_source_season_leagueCode: {
                teamId: r.dbTeamId,
                source: 'understat',
                season: UNDERSTAT_SEASON,
                leagueCode,
              },
            },
            update: {
              xgPerGame,
              xgaPerGame,
              npxGPerGame: matchesPlayed > 0 ? Math.round((npxg / matchesPlayed) * 100) / 100 : null,
              npxgaPerGame: matchesPlayed > 0 ? Math.round((npxga / matchesPlayed) * 100) / 100 : null,
              ppda,
              ppdaAllowed,
              deep,
              deepAllowed,
              syncedAt: new Date(),
            },
            create: {
              teamId: r.dbTeamId,
              source: 'understat',
              season: UNDERSTAT_SEASON,
              leagueCode,
              xgPerGame,
              xgaPerGame,
              npxGPerGame: matchesPlayed > 0 ? Math.round((npxg / matchesPlayed) * 100) / 100 : null,
              npxgaPerGame: matchesPlayed > 0 ? Math.round((npxga / matchesPlayed) * 100) / 100 : null,
              ppda,
              ppdaAllowed,
              deep,
              deepAllowed,
              sourceTeamId: String(ut.id),
              sourceTeamName: r.understatTeamName,
              syncedAt: new Date(),
            },
          })
          result.updated++
        } catch (err) {
          console.warn(`[SYNC/Understat] Failed to upsert for ${r.matchedDbTeamName}:`, err)
        }
      }

      // Log unresolved teams
      for (const u of unresolved) {
        console.warn(
          `[SYNC/Understat] UNRESOLVED: ${u.understatTeamName} ` +
          `(id=${u.understatTeamId}, league=${leagueCode})`,
        )
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) throw err
      console.warn(`[SYNC/Understat] Failed for ${leagueCode}:`, err.message)
    }
  }

  await logSync('understat', 'team_analytics', 'success',
    result.resolved + result.unresolved, result.resolved, result.updated)

  return result
}

// ── API-Sports Teams Sync (full team info + venue) ────────────────────────

async function syncTeamsFromApiSports(): Promise<{
  created: number
  updated: number
}> {
  const result = { created: 0, updated: 0 }
  const topLeagues = AS_LEAGUES.slice(0, 5)

  for (const league of topLeagues) {
    checkTimeout()
    try {
      // Free plan covers 2022-2024
      const teams = await fetchLeagueTeams(league.id, 2024)
      for (const t of teams) {
        checkTimeout()
        try {
          await db.team.upsert({
            where: { source_sourceId: { source: 'api-sports', sourceId: String(t.id) } },
            update: {
              name: t.name,
              code: t.code || t.name.substring(0, 3).toUpperCase(),
              logo: t.logo,
              country: t.country,
              founded: t.founded,
              venueName: t.venue?.name,
              venueCapacity: t.venue?.capacity,
              league: league.name,
              leagueCode: league.code,
              source: 'api-sports',
              lastSyncedAt: new Date(),
            },
            create: {
              externalId: String(t.id),
              name: t.name,
              code: t.code || t.name.substring(0, 3).toUpperCase(),
              logo: t.logo,
              country: t.country,
              founded: t.founded,
              venueName: t.venue?.name,
              venueCapacity: t.venue?.capacity,
              league: league.name,
              leagueCode: league.code,
              source: 'api-sports',
              sourceId: String(t.id),
            },
          })
          result.created++
        } catch {
          result.updated++
        }
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) throw err
      console.warn(`[SYNC/API-Sports] Teams failed for ${league.code}:`, err.message)
    }
  }

  return result
}

// ── API-Sports Player Stats Sync (top scorers + squad info) ───────────────

async function syncPlayersFromApiSports(): Promise<{
  created: number
  updated: number
}> {
  const result = { created: 0, updated: 0 }
  const topLeagues = AS_LEAGUES.slice(0, 5)

  for (const league of topLeagues) {
    checkTimeout()
    try {
      // Free plan covers 2022-2024
      const scorers = await fetchTopScorers(league.id, 2024)
      for (const s of scorers) {
        checkTimeout()
        const p = s.player
        const stat = s.statistics?.[0]
        if (!stat) continue

        // Find or create the team
        const teamSourceId = String(stat.team.id)
        let team = await db.team.findUnique({
          where: { source_sourceId: { source: 'api-sports', sourceId: teamSourceId } },
        })
        if (!team) {
          team = await db.team.create({
            data: {
              externalId: teamSourceId,
              name: stat.team.name,
              code: stat.team.name.substring(0, 3).toUpperCase(),
              logo: stat.team.logo,
              league: league.name,
              leagueCode: league.code,
              source: 'api-sports',
              sourceId: teamSourceId,
            },
          })
        }

        try {
          await db.player.upsert({
            where: { source_sourceId: { source: 'api-sports', sourceId: String(p.id) } },
            update: {
              name: p.name,
              firstName: p.firstname,
              lastName: p.lastname,
              age: p.age,
              nationality: p.nationality,
              photo: p.photo,
              teamId: team.id,
              appearances: stat.games?.appearences || 0,
              minutesPlayed: stat.games?.minutes || 0,
              goals: stat.goals?.total || 0,
              assists: stat.goals?.assists || 0,
              yellowCards: stat.cards?.yellow || 0,
              redCards: stat.cards?.red || 0,
              rating: null, // API-Sports top scorers doesn't include rating
              season: String(league.id), // store league id for reference
              source: 'api-sports',
              lastSyncedAt: new Date(),
            },
            create: {
              externalId: String(p.id),
              name: p.name,
              firstName: p.firstname,
              lastName: p.lastname,
              age: p.age,
              nationality: p.nationality,
              photo: p.photo,
              teamId: team.id,
              appearances: stat.games?.appearences || 0,
              minutesPlayed: stat.games?.minutes || 0,
              goals: stat.goals?.total || 0,
              assists: stat.goals?.assists || 0,
              yellowCards: stat.cards?.yellow || 0,
              redCards: stat.cards?.red || 0,
              season: String(league.id),
              source: 'api-sports',
              sourceId: String(p.id),
            },
          })
          result.created++
        } catch {
          result.updated++
        }
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) throw err
      console.warn(`[SYNC/API-Sports] Players failed for ${league.code}:`, err.message)
    }
  }

  return result
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESPN SYNC — Fallback (no API key needed, but lower quality)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchScoreboardForLeague(league: { espnId: string; name: string; code: string }) {
  const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer'
  const url = `${SITE_V2}/${league.espnId}/scoreboard`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    const events: any[] = []
    for (const event of data.events || []) {
      const comp = event.competitions?.[0]
      if (!comp) continue
      const competitors = comp.competitors || []
      if (competitors.length < 2) continue
      const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0]
      const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1]
      const statusDetail = comp.status?.type?.detail || ''
      const minuteMatch = statusDetail.match(/(\d+)\s*'/)
      events.push({
        id: event.id?.toString() || '',
        homeTeamId: home.team?.id?.toString() || '',
        homeTeamName: home.team?.displayName || 'Unknown',
        homeTeamAbbr: home.team?.abbreviation || '???',
        homeTeamLogo: home.team?.logo || '',
        homeTeamColor: home.team?.color || '#00e676',
        awayTeamId: away.team?.id?.toString() || '',
        awayTeamName: away.team?.displayName || 'Unknown',
        awayTeamAbbr: away.team?.abbreviation || '???',
        awayTeamLogo: away.team?.logo || '',
        awayTeamColor: away.team?.color || '#ffffff',
        homeScore: parseInt(home.score) || 0,
        awayScore: parseInt(away.score) || 0,
        status: comp.status?.type?.name || 'STATUS_SCHEDULED',
        date: event.date || '',
        venue: comp.venue?.fullName || '',
        competition: event.name || league.name,
        competitionCode: league.code,
        minute: minuteMatch ? parseInt(minuteMatch[1]) : undefined,
      })
    }
    return events
  } catch (err) {
    console.error(`[SYNC/ESPN] Failed to fetch ${league.espnId}:`, err)
    return []
  }
}

async function syncFixturesFromESPN(): Promise<{
  created: number
  updated: number
  processed: number
}> {
  const result = { created: 0, updated: 0, processed: 0 }

  const results = await Promise.allSettled(
    ESPN_LEAGUES.map(league => fetchScoreboardForLeague(league))
  )

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const matches = r.value
    for (const m of matches) {
      checkTimeout()
      result.processed++

      const homeTeam = await db.team.upsert({
        where: { source_sourceId: { source: 'espn', sourceId: m.homeTeamId } },
        update: {
          name: m.homeTeamName,
          code: m.homeTeamAbbr,
          logo: m.homeTeamLogo,
          primaryColor: m.homeTeamColor,
          leagueCode: m.competitionCode,
          source: 'espn',
          lastSyncedAt: new Date(),
        },
        create: {
          externalId: m.homeTeamId,
          name: m.homeTeamName,
          code: m.homeTeamAbbr,
          logo: m.homeTeamLogo,
          primaryColor: m.homeTeamColor,
          leagueCode: m.competitionCode,
          source: 'espn',
          sourceId: m.homeTeamId,
        },
      })

      const awayTeam = await db.team.upsert({
        where: { source_sourceId: { source: 'espn', sourceId: m.awayTeamId } },
        update: {
          name: m.awayTeamName,
          code: m.awayTeamAbbr,
          logo: m.awayTeamLogo,
          primaryColor: m.awayTeamColor,
          leagueCode: m.competitionCode,
          source: 'espn',
          lastSyncedAt: new Date(),
        },
        create: {
          externalId: m.awayTeamId,
          name: m.awayTeamName,
          code: m.awayTeamAbbr,
          logo: m.awayTeamLogo,
          primaryColor: m.awayTeamColor,
          leagueCode: m.competitionCode,
          source: 'espn',
          sourceId: m.awayTeamId,
        },
      })

      const matchData = {
        externalId: m.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        competition: m.competition,
        competitionCode: m.competitionCode,
        date: m.date ? new Date(m.date) : null,
        status: mapStatus(m.status),
        minute: m.minute ?? null,
        venue: m.venue,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        source: 'espn',
        sourceId: m.id,
        lastSyncedAt: new Date(),
      }

      try {
        await db.match.upsert({
          where: { source_sourceId: { source: 'espn', sourceId: m.id } },
          update: matchData,
          create: matchData,
        })
        result.created++
      } catch {
        result.updated++
      }
    }
  }

  return result
}

// ── ESPN Standings Sync ────────────────────────────────────────────────────

async function syncStandingsFromESPN(): Promise<{
  created: number
}> {
  const topLeagues = ['PL', 'LIGA', 'SA', 'BL', 'L1']
  let totalCreated = 0
  const season = String(new Date().getFullYear())

  const results = await Promise.allSettled(
    topLeagues.map(async (code) => {
      const league = ESPN_LEAGUES.find(l => l.code === code)
      if (!league) return []
      const standings = await fetchESPNStandings(code)
      return standings.map(s => ({
        leagueCode: code,
        leagueName: league.name,
        ...s,
      }))
    })
  )

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const entry of r.value) {
      checkTimeout()
      const code = entry.leagueCode
      const leagueName = entry.leagueName
      try {
        await db.standingEntry.upsert({
          where: {
            competitionCode_season_teamName: {
              competitionCode: code,
              season,
              teamName: entry.team,
            },
          },
          update: {
            teamCode: entry.code,
            teamLogo: entry.logo,
            competition: leagueName,
            rank: entry.rank,
            played: entry.played,
            wins: entry.wins,
            draws: entry.draws,
            losses: entry.losses,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
            goalDiff: entry.goalDiff,
            points: entry.points,
            form: entry.form || null,
            homeRecord: entry.homeRecord || null,
            source: 'espn',
            lastSyncedAt: new Date(),
          },
          create: {
            teamName: entry.team,
            teamCode: entry.code,
            teamLogo: entry.logo,
            competition: leagueName,
            competitionCode: code,
            season,
            rank: entry.rank,
            played: entry.played,
            wins: entry.wins,
            draws: entry.draws,
            losses: entry.losses,
            goalsFor: entry.goalsFor,
            goalsAgainst: entry.goalsAgainst,
            goalDiff: entry.goalDiff,
            points: entry.points,
            form: entry.form || null,
            homeRecord: entry.homeRecord || null,
            source: 'espn',
          },
        })
        totalCreated++
      } catch (err) {
        console.warn(`[SYNC/Standings] Failed to upsert ${entry.team} in ${code}:`, err)
      }
    }
  }

  return { created: totalCreated }
}

// ── SyncLog Helper ──────────────────────────────────────────────────────────

async function logSync(
  source: string,
  action: string,
  status: string,
  processed: number,
  created: number,
  updated: number,
  errorMessage?: string
) {
  try {
    await db.syncLog.create({
      data: {
        source,
        action,
        status,
        recordsProcessed: processed,
        recordsCreated: created,
        recordsUpdated: updated,
        durationMs: elapsed(),
        errorMessage: errorMessage || null,
      },
    })
  } catch (err) {
    console.error('[SYNC] Failed to write SyncLog:', err)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // 1. Validate cron secret
  if (!validateCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary: any = {
    success: true,
    syncs: {
      fixtures: { source: 'none', created: 0, updated: 0 },
      standings: { source: 'none', created: 0, updated: 0 },
      teams: { source: 'none', created: 0, updated: 0 },
      players: { source: 'none', created: 0, updated: 0 },
      understat: { source: 'none', resolved: 0, unresolved: 0, updated: 0 },
    },
    durationMs: 0,
  }

  try {
    // ═══ 2. API-Sports: Fixtures + Standings + Teams + Players ═══
    let apiSportsAvailable = false

    // 2a. Fixtures (live + today's top 5 leagues)
    try {
      const fixResult = await syncFixturesFromApiSports()
      if (fixResult.processed > 0) {
        apiSportsAvailable = true
        summary.syncs.fixtures = {
          source: 'api-sports',
          created: fixResult.created,
          updated: fixResult.updated,
        }
        await logSync('api-sports', 'fixtures', 'success', fixResult.processed, fixResult.created, fixResult.updated)
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        console.warn('[SYNC] API-Sports fixtures timeout')
        await logSync('api-sports', 'fixtures', 'partial', 0, 0, 0, err.message)
      } else {
        console.warn('[SYNC] API-Sports fixtures failed:', err.message)
      }
    }

    // 2b. Standings (top 10 leagues — only if API-Sports is working)
    if (apiSportsAvailable) {
      try {
        const stResult = await syncStandingsFromApiSports()
        summary.syncs.standings = {
          source: 'api-sports',
          created: stResult.created,
          updated: stResult.updated,
        }
        await logSync('api-sports', 'standings', 'success', stResult.created, stResult.created, stResult.updated)
      } catch (err: any) {
        if (err.message?.includes('timeout')) {
          console.warn('[SYNC] API-Sports standings timeout')
          await logSync('api-sports', 'standings', 'partial', 0, 0, 0, err.message)
        } else {
          console.warn('[SYNC] API-Sports standings failed:', err.message)
        }
      }
    }

    // 2c. Teams (top 5 leagues — venue info, country, etc.)
    if (apiSportsAvailable) {
      try {
        const tmResult = await syncTeamsFromApiSports()
        summary.syncs.teams = {
          source: 'api-sports',
          created: tmResult.created,
          updated: tmResult.updated,
        }
        await logSync('api-sports', 'teams', 'success', tmResult.created + tmResult.updated, tmResult.created, tmResult.updated)
      } catch (err: any) {
        if (err.message?.includes('timeout')) {
          console.warn('[SYNC] API-Sports teams timeout')
        } else {
          console.warn('[SYNC] API-Sports teams failed:', err.message)
        }
      }
    }

    // 2d. Player stats (top scorers, top 5 leagues)
    if (apiSportsAvailable) {
      try {
        const plResult = await syncPlayersFromApiSports()
        summary.syncs.players = {
          source: 'api-sports',
          created: plResult.created,
          updated: plResult.updated,
        }
        await logSync('api-sports', 'players', 'success', plResult.created + plResult.updated, plResult.created, plResult.updated)
      } catch (err: any) {
        if (err.message?.includes('timeout')) {
          console.warn('[SYNC] API-Sports players timeout')
        } else {
          console.warn('[SYNC] API-Sports players failed:', err.message)
        }
      }
    }

    // ═══ 3. Understat Analytical Enrichment ═══
    try {
      checkTimeout()
      const usResult = await syncUnderstatAnalytics()
      summary.syncs.understat = {
        source: 'understat',
        resolved: usResult.resolved,
        unresolved: usResult.unresolved,
        updated: usResult.updated,
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        console.warn('[SYNC] Understat timeout')
        await logSync('understat', 'team_analytics', 'partial', 0, 0, 0, err.message)
      } else {
        console.warn('[SYNC] Understat failed:', err.message)
      }
    }

    // ═══ 4. ESPN Fallback — only if API-Sports didn't return fixtures ═══
    if (!apiSportsAvailable) {
      try {
        const espnResult = await syncFixturesFromESPN()
        summary.syncs.fixtures = {
          source: 'espn',
          created: espnResult.created,
          updated: espnResult.updated,
        }
        await logSync('espn', 'fixtures', 'success', espnResult.processed, espnResult.created, espnResult.updated)
      } catch (err: any) {
        console.error('[SYNC] ESPN fixtures failed:', err)
        await logSync('espn', 'fixtures', 'error', 0, 0, 0, String(err))
        summary.syncs.fixtures.error = String(err)
      }

      // ESPN Standings fallback
      try {
        const standingsResult = await syncStandingsFromESPN()
        summary.syncs.standings = {
          source: 'espn',
          created: standingsResult.created,
          updated: 0,
        }
        await logSync('espn', 'standings', 'success', standingsResult.created, standingsResult.created, 0)
      } catch (err: any) {
        if (err.message?.includes('timeout')) {
          console.warn('[SYNC] ESPN standings timeout')
          await logSync('espn', 'standings', 'partial', 0, 0, 0, err.message)
        } else {
          console.error('[SYNC] ESPN standings failed:', err)
          await logSync('espn', 'standings', 'error', 0, 0, 0, String(err))
        }
      }
    }

    summary.durationMs = elapsed()
    console.log(`[SYNC] Complete in ${summary.durationMs}ms`, JSON.stringify(summary.syncs))

    return NextResponse.json(summary)
  } catch (error) {
    const duration = elapsed()
    console.error(`[SYNC] Fatal error after ${duration}ms:`, error)
    summary.success = false
    summary.durationMs = duration
    summary.error = error instanceof Error ? error.message : String(error)
    return NextResponse.json(summary, { status: 500 })
  }
}

// Also allow POST for manual triggering
export async function POST(req: NextRequest) {
  return GET(req)
}
