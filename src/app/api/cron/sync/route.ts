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
  mapASStatus,
  AS_LEAGUES,
  type ASFixture,
} from '@/lib/api-sports'

export const maxDuration = 25 // Vercel hobby limit safety margin

const SYNC_START = Date.now()
const TIMEOUT_MS = 23_000 // Stop early if approaching Vercel 30s limit

function elapsed() {
  return Date.now() - SYNC_START
}

function checkTimeout() {
  if (elapsed() > TIMEOUT_MS) {
    throw new Error(' approaching Vercel timeout, stopping early')
  }
}

// ── Cron Secret Validation ──────────────────────────────────────────────────

function validateCron(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET || 'elastico-cron-2024'
  return secret === expected
}

// ── API-Sports Sync (higher quality, but key may be expired) ────────────────

async function syncFixturesFromApiSports(): Promise<{
  created: number
  updated: number
  processed: number
}> {
  const result = { created: 0, updated: 0, processed: 0 }

  try {
    // Try live fixtures first (quick check)
    const liveFixtures = await fetchLiveFixtures()
    if (!liveFixtures || liveFixtures.length === 0) return result

    console.log(`[SYNC/API-Sports] Got ${liveFixtures.length} live fixtures`)

    for (const f of liveFixtures) {
      checkTimeout()
      await upsertApiSportsFixture(f, result)
    }

    // Also get today's fixtures
    const todayFixtures = await fetchFixtures(39) // PL
    if (todayFixtures) {
      for (const f of todayFixtures.slice(0, 20)) {
        checkTimeout()
        await upsertApiSportsFixture(f, result)
      }
    }
  } catch (err: any) {
    if (err.message?.includes('timeout')) throw err
    console.warn('[SYNC/API-Sports] Failed, falling back to ESPN:', err.message || err)
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
      leagueCode,
      source: 'api-sports',
      lastSyncedAt: new Date(),
    },
    create: {
      externalId: String(f.teams.home.id),
      name: f.teams.home.name,
      code: f.teams.home.name.substring(0, 3).toUpperCase(),
      logo: f.teams.home.logo,
      leagueCode,
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
      leagueCode,
      source: 'api-sports',
      lastSyncedAt: new Date(),
    },
    create: {
      externalId: String(f.teams.away.id),
      name: f.teams.away.name,
      code: f.teams.away.name.substring(0, 3).toUpperCase(),
      logo: f.teams.away.logo,
      leagueCode,
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

// ── ESPN Sync (primary for now, no key needed) ─────────────────────────────

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

      // Upsert home team
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

      // Upsert away team
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

      // Upsert match
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

// ── Standings Sync ──────────────────────────────────────────────────────────

async function syncStandingsFromESPN(): Promise<{
  created: number
  source: string
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

  return { created: totalCreated, source: 'espn' }
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

// ── Main Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // 1. Validate cron secret
  if (!validateCron(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const summary: any = {
    success: true,
    syncs: {
      fixtures: { source: 'none', created: 0, updated: 0 },
      standings: { source: 'none', created: 0 },
      players: { source: 'none', created: 0 },
    },
    durationMs: 0,
  }

  try {
    // 2. Try API-Sports first (higher quality data)
    let useApiSports = false
    try {
      const asResult = await syncFixturesFromApiSports()
      if (asResult.processed > 0) {
        useApiSports = true
        summary.syncs.fixtures = {
          source: 'api-sports',
          created: asResult.created,
          updated: asResult.updated,
        }
        await logSync('api-sports', 'fixtures', 'success', asResult.processed, asResult.created, asResult.updated)
      }
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        console.warn('[SYNC] API-Sports timeout, using ESPN')
        await logSync('api-sports', 'fixtures', 'partial', 0, 0, 0, err.message)
      } else {
        console.warn('[SYNC] API-Sports unavailable, using ESPN')
      }
    }

    // 3. Fall back to ESPN if API-Sports didn't return data
    if (!useApiSports) {
      try {
        const espnResult = await syncFixturesFromESPN()
        summary.syncs.fixtures = {
          source: 'espn',
          created: espnResult.created,
          updated: espnResult.updated,
        }
        await logSync('espn', 'fixtures', 'success', espnResult.processed, espnResult.created, espnResult.updated)
      } catch (err: any) {
        console.error('[SYNC] ESPN fixtures sync failed:', err)
        await logSync('espn', 'fixtures', 'error', 0, 0, 0, String(err))
        summary.syncs.fixtures.error = String(err)
      }
    }

    // 4. Sync standings (always ESPN)
    try {
      const standingsResult = await syncStandingsFromESPN()
      summary.syncs.standings = {
        source: standingsResult.source,
        created: standingsResult.created,
      }
      await logSync('espn', 'standings', 'success', standingsResult.created, standingsResult.created, 0)
    } catch (err: any) {
      if (err.message?.includes('timeout')) {
        console.warn('[SYNC] Standings sync hit timeout')
        await logSync('espn', 'standings', 'partial', 0, 0, 0, err.message)
      } else {
        console.error('[SYNC] Standings sync failed:', err)
        await logSync('espn', 'standings', 'error', 0, 0, 0, String(err))
        summary.syncs.standings.error = String(err)
      }
    }

    // 5. Players sync placeholder (ready for when API-Sports key is active)
    summary.syncs.players = { source: 'none', created: 0 }

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
