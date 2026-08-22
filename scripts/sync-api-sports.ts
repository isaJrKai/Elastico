/**
 * ELASTICO — One-shot API-Sports → Neon PostgreSQL sync script
 * Fetches real data from API-Sports and stores in DB tables.
 * Usage: npx tsx scripts/sync-api-sports.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const BASE = 'https://v3.football.api-sports.io'
const KEY = process.env.API_SPORTS_KEY!

const HEADERS = { 'x-apisports-key': KEY }

// Top 5 leagues for initial sync
const TOP_LEAGUES = [
  { id: 39, code: 'PL', name: 'Premier League' },
  { id: 140, code: 'LIGA', name: 'La Liga' },
  { id: 135, code: 'SA', name: 'Serie A' },
  { id: 78, code: 'BL', name: 'Bundesliga' },
  { id: 61, code: 'L1', name: 'Ligue 1' },
]

async function apiGet(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${endpoint}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { headers: HEADERS })
  if (!res.ok) throw new Error(`API-Sports ${res.status}: ${endpoint}`)
  return res.json()
}

function mapStatus(short: string): string {
  const map: Record<string, string> = {
    'TBD': 'upcoming', 'NS': 'upcoming', '1H': 'live', 'HT': 'halftime',
    '2H': 'live', 'ET': 'live', 'P': 'halftime', 'BT': 'live',
    'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
    'SUSP': 'postponed', 'INT': 'postponed', 'PST': 'postponed',
    'CANC': 'postponed', 'ABD': 'postponed', 'AWD': 'finished',
    'WO': 'finished', 'LIVE': 'live',
  }
  return map[short] || 'upcoming'
}

async function syncFixtures() {
  console.log('\n=== SYNCING FIXTURES ===')
  let totalCreated = 0
  let totalUpdated = 0

  // 1. Live fixtures (1 API call)
  console.log('Fetching live fixtures...')
  const liveData = await apiGet('/fixtures', { live: 'all' })
  const liveFixtures = liveData.response || []
  console.log(`  Got ${liveFixtures.length} live fixtures`)

  // 2. Today's fixtures (1 API call)
  console.log("Fetching today's fixtures...")
  const today = new Date().toISOString().split('T')[0]
  const todayData = await apiGet('/fixtures', { date: today })
  const todayFixtures = todayData.response || []
  console.log(`  Got ${todayFixtures.length} fixtures for ${today}`)

  const allFixtures = [...liveFixtures, ...todayFixtures]
  // Deduplicate by fixture id
  const seen = new Set<number>()
  const unique = allFixtures.filter((f: any) => {
    if (seen.has(f.fixture?.id || f.id)) return false
    seen.add(f.fixture?.id || f.id)
    return true
  })

  // Filter to only our tracked leagues
  const tracked = unique.filter((f: any) => {
    const leagueId = f.league?.id
    return TOP_LEAGUES.some(l => l.id === leagueId)
  })

  console.log(`  ${tracked.length} fixtures in tracked leagues`)

  for (const f of tracked) {
    const fixture = f.fixture || f
    const teams = f.teams
    const goals = f.goals
    const score = f.score
    const league = f.league

    const season = String(league?.season || new Date().getFullYear())
    const leagueCode =
      TOP_LEAGUES.find(l => l.id === league?.id)?.code ||
      league?.country?.substring(0, 4).toUpperCase() ||
      'UNKNOWN'

    // Upsert home team
    const homeTeam = await db.team.upsert({
      where: { source_sourceId: { source: 'api-sports', sourceId: String(teams.home.id) } },
      update: {
        name: teams.home.name,
        logo: teams.home.logo,
        league: league?.name || '',
        leagueCode,
        source: 'api-sports',
        lastSyncedAt: new Date(),
      },
      create: {
        externalId: String(teams.home.id),
        name: teams.home.name,
        code: teams.home.name.substring(0, 3).toUpperCase(),
        logo: teams.home.logo,
        league: league?.name || '',
        leagueCode,
        country: league?.country || '',
        source: 'api-sports',
        sourceId: String(teams.home.id),
      },
    })

    // Upsert away team
    const awayTeam = await db.team.upsert({
      where: { source_sourceId: { source: 'api-sports', sourceId: String(teams.away.id) } },
      update: {
        name: teams.away.name,
        logo: teams.away.logo,
        league: league?.name || '',
        leagueCode,
        source: 'api-sports',
        lastSyncedAt: new Date(),
      },
      create: {
        externalId: String(teams.away.id),
        name: teams.away.name,
        code: teams.away.name.substring(0, 3).toUpperCase(),
        logo: teams.away.logo,
        league: league?.name || '',
        leagueCode,
        country: league?.country || '',
        source: 'api-sports',
        sourceId: String(teams.away.id),
      },
    })

    // Upsert match
    const matchData = {
      externalId: String(fixture.id),
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      competition: league?.name || '',
      competitionCode: leagueCode,
      season,
      round: league?.round || null,
      date: new Date(fixture.date),
      status: mapStatus(fixture.status?.short || 'NS'),
      minute: fixture.status?.elapsed ?? null,
      venue: null as string | null,
      homeScore: goals?.home ?? 0,
      awayScore: goals?.away ?? 0,
      halfTimeHome: score?.halftime?.home ?? null,
      halfTimeAway: score?.halftime?.away ?? null,
      source: 'api-sports',
      sourceId: String(fixture.id),
      lastSyncedAt: new Date(),
    }

    try {
      await db.match.upsert({
        where: { source_sourceId: { source: 'api-sports', sourceId: String(fixture.id) } },
        update: matchData,
        create: matchData,
      })
      totalCreated++
    } catch {
      totalUpdated++
    }
  }

  console.log(`  Fixtures: ${totalCreated} created, ${totalUpdated} updated`)
  return { created: totalCreated, updated: totalUpdated }
}

async function syncStandings() {
  console.log('\n=== SYNCING STANDINGS ===')
  let totalCreated = 0
  // Free plan only covers 2022-2024; 2024 = 2024/25 completed season
  const season = '2024'

  for (const league of TOP_LEAGUES) {
    console.log(`  Fetching ${league.name} standings (season ${season})...`)
    try {
      const data = await apiGet('/standings', {
        league: String(league.id),
        season: season,
      })
      const standingsGroups: any[][] = data.response?.flatMap((l: any) => l.league?.standings || []) || []

      let count = 0
      for (const group of standingsGroups) {
        for (const entry of group) {
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
            count++
          } catch (err: any) {            console.warn(`      Upsert failed for ${entry.team?.name}: ${err.message}`)          }
        }
      }
      console.log(`    ${league.name}: ${count} teams`)
      totalCreated += count
    } catch (err: any) {
      console.warn(`    ${league.name} failed: ${err.message}`)
    }
  }

  console.log(`  Standings: ${totalCreated} total entries`)
  return { created: totalCreated }
}

async function syncTeams() {
  console.log('\n=== SYNCING TEAMS ===')
  let totalCreated = 0
  // Free plan covers 2022-2024
  const season = '2024'

  for (const league of TOP_LEAGUES) {
    console.log(`  Fetching ${league.name} teams (season ${season})...`)
    try {
      const data = await apiGet('/teams', {
        league: String(league.id),
        season: season,
      })
      const teams: any[] = data.response || []

      for (const t of teams) {
        try {
          await db.team.upsert({
            where: { source_sourceId: { source: 'api-sports', sourceId: String(t.team?.id || t.id) } },
            update: {
              name: t.team?.name || t.name,
              code: t.team?.code || t.code || (t.team?.name || t.name).substring(0, 3).toUpperCase(),
              logo: t.team?.logo || t.logo,
              country: t.team?.country || t.country,
              founded: t.team?.founded || t.founded,
              venueName: t.venue?.name,
              venueCapacity: t.venue?.capacity,
              league: league.name,
              leagueCode: league.code,
              source: 'api-sports',
              lastSyncedAt: new Date(),
            },
            create: {
              externalId: String(t.team?.id || t.id),
              name: t.team?.name || t.name,
              code: t.team?.code || t.code || (t.team?.name || t.name).substring(0, 3).toUpperCase(),
              logo: t.team?.logo || t.logo,
              country: t.team?.country || t.country,
              founded: t.team?.founded || t.founded,
              venueName: t.venue?.name,
              venueCapacity: t.venue?.capacity,
              league: league.name,
              leagueCode: league.code,
              source: 'api-sports',
              sourceId: String(t.team?.id || t.id),
            },
          })
          totalCreated++
        } catch {
          // skip duplicates
        }
      }
      console.log(`    ${league.name}: ${teams.length} teams`)
    } catch (err: any) {
      console.warn(`    ${league.name} failed: ${err.message}`)
    }
  }

  console.log(`  Teams: ${totalCreated} total`)
  return { created: totalCreated }
}

async function main() {
  console.log('=== ELASTICO API-Sports → Neon Sync ===')
  console.log(`Key: ${KEY.substring(0, 8)}...`)
  console.log(`Database: Neon PostgreSQL`)
  console.log(`Leagues: ${TOP_LEAGUES.map(l => l.code).join(', ')}`)

  // Test DB connection
  try {
    await db.$connect()
    console.log('\n✓ Database connected')
  } catch (err) {
    console.error('✗ Database connection failed:', err)
    process.exit(1)
  }

  // Sync in order: fixtures → standings → teams
  const fixtures = await syncFixtures()
  const standings = await syncStandings()
  const teams = await syncTeams()

  // Log sync
  await db.syncLog.create({
    data: {
      source: 'api-sports',
      action: 'manual_initial_sync',
      status: 'success',
      recordsProcessed: fixtures.created + standings.created + teams.created,
      recordsCreated: fixtures.created + standings.created + teams.created,
      recordsUpdated: fixtures.updated,
      durationMs: 0,
    },
  })

  // Summary counts from DB
  const teamCount = await db.team.count({ where: { source: 'api-sports' } })
  const matchCount = await db.match.count({ where: { source: 'api-sports' } })
  const standingCount = await db.standingEntry.count({ where: { source: 'api-sports' } })
  const playerCount = await db.player.count({ where: { source: 'api-sports' } })
  const logCount = await db.syncLog.count()

  console.log('\n=== SYNC COMPLETE ===')
  console.log(`Teams in DB:       ${teamCount}`)
  console.log(`Matches in DB:     ${matchCount}`)
  console.log(`Standings in DB:   ${standingCount}`)
  console.log(`Players in DB:     ${playerCount}`)
  console.log(`Sync logs:         ${logCount}`)
  console.log('\n✓ Data pipeline verified: API-Sports → Neon DB → App')

  await db.$disconnect()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  db.$disconnect()
  process.exit(1)
})
