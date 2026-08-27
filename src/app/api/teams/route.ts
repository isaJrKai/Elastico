import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchTeams, fetchStandings } from '@/lib/football-data'
import { fetchLeagueTeams as fetchASLeagueTeams, fetchStandings as fetchASStandings, AS_LEAGUES } from '@/lib/api-sports'

import { rateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

/** Dynamic season */
function getSeason(): number {
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

/**
 * GET /api/teams
 *
 * Serves teams with xG analytics from the canonical data model.
 * Strategy:
 *   1. Query CanonicalTeams with TeamAnalytics
 *   2. Fallback: legacy Team table
 *   3. Fallback: API-Sports live
 *   4. Final fallback: ESPN live fetch
 */

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`teams:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const league = searchParams.get('league') || undefined
    const search = searchParams.get('search') || undefined

    // ── 1. Try CanonicalTeam path ──────────────────────────────────────
    const canonicalWhere: any = {}
    if (league) canonicalWhere.leagueCode = league
    if (search) canonicalWhere.displayName = { contains: search, mode: 'insensitive' }

    const canonicalTeams = await db.canonicalTeam.findMany({
      where: canonicalWhere,
      include: {
        identities: true,
        analytics: { orderBy: { syncedAt: 'desc' }, take: 1 },
      },
      orderBy: { displayName: 'asc' },
    })

    if (canonicalTeams.length > 0) {
      const canonicalNames = canonicalTeams.map(ct => ct.displayName)
      const leagueCode = league || 'PL'
      const [legacyTeams, standings] = await Promise.all([
        db.team.findMany({ where: { name: { in: canonicalNames } } }),
        db.standingEntry.findMany({ where: { competitionCode: leagueCode } }),
      ])
      const legacyMap = new Map(legacyTeams.map(t => [t.name, t]))
      const formMap = new Map(standings.map(s => [s.teamName, s.form]))

      const teams = canonicalTeams.map(ct => {
        const legacy = legacyMap.get(ct.displayName)
        const analytic = ct.analytics[0]
        return {
          id: legacy?.id || ct.id, externalId: legacy?.externalId || null,
          name: ct.displayName, code: ct.shortCode || legacy?.code || '',
          logo: legacy?.logo || ct.logo || '',
          primaryColor: legacy?.primaryColor || ct.primaryColor,
          secondaryColor: legacy?.secondaryColor || ct.secondaryColor,
          country: ct.country || legacy?.country || '',
          league: legacy?.league || '', leagueCode: ct.leagueCode || legacy?.leagueCode || '',
          eloRating: legacy?.eloRating ?? ct.eloRating,
          wins: legacy?.wins ?? 0, draws: legacy?.draws ?? 0, losses: legacy?.losses ?? 0,
          goalsFor: legacy?.goalsFor ?? 0, goalsAgainst: legacy?.goalsAgainst ?? 0,
          playerCount: 0, source: 'canonical',
          lastSyncedAt: legacy?.lastSyncedAt?.toISOString() || null,
          xgPerGame: analytic?.xgPerGame ?? null, xgaPerGame: analytic?.xgaPerGame ?? null,
          npxGPerGame: analytic?.npxGPerGame ?? null,
          xgTruthClass: analytic?.truthClass ?? null, xgSource: analytic?.source ?? null,
          xgFreshness: analytic?.dataFreshness ?? null, xgSyncedAt: analytic?.syncedAt?.toISOString() || null,
          form: formMap.get(ct.displayName) || null,
          possession: null, passAccuracy: null, pressIntensity: null, style: null,
        }
      })
      return NextResponse.json({ teams, source: 'canonical', total: teams.length })
    }

    // ── 2. Fallback: legacy Team table ──────────────────────────────────
    const where: any = {}
    if (league) where.leagueCode = league
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const leagueCode2 = league || 'PL'
    const [dbTeams, standingsLegacy] = await Promise.all([
      db.team.findMany({
        where,
        include: {
          _count: { select: { players: true } },
          analytics: { where: { source: 'understat' }, orderBy: { syncedAt: 'desc' }, take: 1 },
        },
        orderBy: { name: 'asc' },
      }),
      db.standingEntry.findMany({ where: { competitionCode: leagueCode2 } }),
    ])
    const formMapLegacy = new Map(standingsLegacy.map(s => [s.teamName, s.form]))

    if (dbTeams.length > 0) {
      const teams = dbTeams.map(t => ({
        id: t.id, externalId: t.externalId, name: t.name, code: t.code,
        logo: t.logo, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor,
        country: t.country, league: t.league, leagueCode: t.leagueCode,
        eloRating: t.eloRating, wins: t.wins, draws: t.draws, losses: t.losses,
        goalsFor: t.goalsFor, goalsAgainst: t.goalsAgainst,
        playerCount: t._count.players, source: t.source,
        lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
        xgPerGame: t.analytics[0]?.xgPerGame ?? null, xgaPerGame: t.analytics[0]?.xgaPerGame ?? null,
        npxGPerGame: t.analytics[0]?.npxGPerGame ?? null,
        xgTruthClass: t.analytics[0]?.truthClass ?? null, xgSource: t.analytics[0]?.source ?? null,
        xgFreshness: t.analytics[0]?.dataFreshness ?? null, xgSyncedAt: t.analytics[0]?.syncedAt?.toISOString() || null,
        form: formMapLegacy.get(t.name) || null,
        possession: null, passAccuracy: null, pressIntensity: null, style: null,
      }))
      return NextResponse.json({ teams, source: 'database', total: teams.length })
    }

    // ── 3. Fallback: API-Sports live ────────────────────────────────────
    const leagueConfig = AS_LEAGUES.find(l => l.code === (league || 'PL'))
    if (leagueConfig) {
      try {
        const season = getSeason()
        const [asTeams, asStandings] = await Promise.all([
          fetchASLeagueTeams(leagueConfig.id, season),
          fetchASStandings(leagueConfig.id, season),
        ])
        const allStandings = asStandings.flat()
        const standingMap = new Map(allStandings.map(s => [s.team.name, s]))

        if (asTeams.length > 0) {
          const teams = asTeams.map(t => {
            const st = standingMap.get(t.name)
            return {
              id: `api-sports-${t.id}`, externalId: String(t.id),
              name: t.name, code: t.code || t.name.substring(0, 3).toUpperCase(),
              logo: t.logo, primaryColor: '#00e676', secondaryColor: '#004d40',
              country: t.country, league: leagueConfig.name, leagueCode: leagueConfig.code,
              eloRating: 1500 + (st?.points ? st.points * 3 - st.rank * 10 : 0),
              wins: st?.all.win ?? 0, draws: st?.all.draw ?? 0, losses: st?.all.lose ?? 0,
              goalsFor: st?.all.goals.for ?? 0, goalsAgainst: st?.all.goals.against ?? 0,
              playerCount: 0, source: 'api-sports', lastSyncedAt: new Date().toISOString(),
              xgPerGame: null, xgaPerGame: null, npxGPerGame: null,
              xgTruthClass: 'MISSING', xgSource: null, xgFreshness: null,
              form: st?.form || null,
              possession: null, passAccuracy: null, pressIntensity: null, style: null,
            }
          })
          return NextResponse.json({ teams, source: 'api-sports', total: teams.length })
        }
      } catch (err) {
        console.warn('[Teams] API-Sports fallback failed:', err)
      }
    }

    // ── 4. Final fallback: ESPN live fetch ──────────────────────────────
    console.log('[Teams] DB empty, falling back to ESPN')
    const leagueCode = league || 'PL'
    const [standingsData, teamsData] = await Promise.all([
      fetchStandings(leagueCode),
      fetchTeams(leagueCode),
    ])

    const logoMap = new Map<string, string>()
    for (const t of teamsData) { logoMap.set(t.name, t.logo); logoMap.set(t.abbreviation, t.logo) }

    if (standingsData.length > 0) {
      const teams = standingsData.map((s, i) => ({
        id: `espn-team-${s.code}-${i}`, name: s.team, code: s.code,
        logo: s.logo || logoMap.get(s.team) || logoMap.get(s.code) || '',
        primaryColor: '#00e676', secondaryColor: '#004d40',
        eloRating: 1500 + (s.points * 3) - (s.rank * 10),
        wins: s.wins, draws: s.draws, losses: s.losses,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        playerCount: 0,
        xgPerGame: null, xgaPerGame: null, npxGPerGame: null,
        xgTruthClass: 'MISSING', xgSource: null, xgFreshness: null,
        form: s.form || null,
        possession: null, passAccuracy: null, pressIntensity: null, style: null,
      }))
      return NextResponse.json({ teams, source: 'espn', total: teams.length })
    }

    if (teamsData.length > 0) {
      const teams = teamsData.map(t => ({
        id: `espn-team-${t.id}`, name: t.name, code: t.abbreviation,
        logo: t.logo, primaryColor: t.color || '#00e676', secondaryColor: '#004d40',
        eloRating: 1500, playerCount: 0,
        xgPerGame: null, xgaPerGame: null, npxGPerGame: null,
        xgTruthClass: 'MISSING', xgSource: null, xgFreshness: null,
        form: null, possession: null, passAccuracy: null, pressIntensity: null, style: null,
      }))
      return NextResponse.json({ teams, source: 'espn', total: teams.length })
    }

    return NextResponse.json({ teams: [], source: 'none', total: 0 })
  } catch (error) {
    console.error('Teams list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
