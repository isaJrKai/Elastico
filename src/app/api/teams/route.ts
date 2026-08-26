import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchTeams, fetchStandings } from '@/lib/football-data'

import { rateLimit } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

/**
 * GET /api/teams
 *
 * Serves teams with xG analytics from the canonical data model.
 * Strategy:
 *   1. Query CanonicalTeams with TeamAnalytics (the Cycle 4+ model)
 *   2. For any canonical teams that also have legacy Team rows, merge logos/stats
 *   3. If no canonical data exists for a league, fall back to legacy Team table
 *   4. Final fallback: ESPN live fetch
 *
 * xG provenance is always included. Missing xG = null, never 0.
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

    // ── 1. Try CanonicalTeam path (Cycle 4+ architecture) ──────────────
    const canonicalWhere: any = {}
    if (league) canonicalWhere.leagueCode = league
    if (search) canonicalWhere.displayName = { contains: search, mode: 'insensitive' }

    const canonicalTeams = await db.canonicalTeam.findMany({
      where: canonicalWhere,
      include: {
        identities: true,
        analytics: {
          orderBy: { syncedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { displayName: 'asc' },
    })

    if (canonicalTeams.length > 0) {
      // Fetch legacy Team rows for logo/stats enrichment (best-effort)
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
          id: legacy?.id || ct.id,
          externalId: legacy?.externalId || null,
          name: ct.displayName,
          code: ct.shortCode || legacy?.code || '',
          logo: legacy?.logo || ct.logo || '',
          primaryColor: legacy?.primaryColor || ct.primaryColor,
          secondaryColor: legacy?.secondaryColor || ct.secondaryColor,
          country: ct.country || legacy?.country || '',
          league: legacy?.league || '',
          leagueCode: ct.leagueCode || legacy?.leagueCode || '',
          eloRating: legacy?.eloRating ?? ct.eloRating,
          wins: legacy?.wins ?? 0,
          draws: legacy?.draws ?? 0,
          losses: legacy?.losses ?? 0,
          goalsFor: legacy?.goalsFor ?? 0,
          goalsAgainst: legacy?.goalsAgainst ?? 0,
          playerCount: 0,
          source: 'canonical',
          lastSyncedAt: legacy?.lastSyncedAt?.toISOString() || null,
          // ── xG analytics with full provenance ──
          xgPerGame: analytic?.xgPerGame ?? null,
          xgaPerGame: analytic?.xgaPerGame ?? null,
          npxGPerGame: analytic?.npxGPerGame ?? null,
          xgTruthClass: analytic?.truthClass ?? null,
          xgSource: analytic?.source ?? null,
          xgFreshness: analytic?.dataFreshness ?? null,
          xgSyncedAt: analytic?.syncedAt?.toISOString() || null,
          // ── Form from standings (REAL — sourced from API-Sports/ESPN) ──
          form: formMap.get(ct.displayName) || null,
          // ── Possession/PassAccuracy/PressIntensity — not available from current sources ──
          possession: null,
          passAccuracy: null,
          pressIntensity: null,
          style: null,
        }
      })

      return NextResponse.json({ teams, source: 'canonical', total: teams.length })
    }

    // ── 2. Fallback: legacy Team table ──────────────────────────────────
    const where: any = {}
    if (league) where.leagueCode = league
    if (search) where.name = { contains: search.toLowerCase() }

    const leagueCode2 = league || 'PL'
    const [dbTeams, standingsLegacy] = await Promise.all([
      db.team.findMany({
        where,
        include: {
          _count: { select: { players: true } },
          analytics: {
            where: { source: 'understat' },
            orderBy: { syncedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      }),
      db.standingEntry.findMany({ where: { competitionCode: leagueCode2 } }),
    ])
    const formMapLegacy = new Map(standingsLegacy.map(s => [s.teamName, s.form]))

    if (dbTeams.length > 0) {
      const teams = dbTeams.map(t => ({
        id: t.id,
        externalId: t.externalId,
        name: t.name,
        code: t.code,
        logo: t.logo,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        country: t.country,
        league: t.league,
        leagueCode: t.leagueCode,
        eloRating: t.eloRating,
        wins: t.wins,
        draws: t.draws,
        losses: t.losses,
        goalsFor: t.goalsFor,
        goalsAgainst: t.goalsAgainst,
        playerCount: t._count.players,
        source: t.source,
        lastSyncedAt: t.lastSyncedAt?.toISOString() || null,
        xgPerGame: t.analytics[0]?.xgPerGame ?? null,
        xgaPerGame: t.analytics[0]?.xgaPerGame ?? null,
        npxGPerGame: t.analytics[0]?.npxGPerGame ?? null,
        xgTruthClass: t.analytics[0]?.truthClass ?? null,
        xgSource: t.analytics[0]?.source ?? null,
        xgFreshness: t.analytics[0]?.dataFreshness ?? null,
        xgSyncedAt: t.analytics[0]?.syncedAt?.toISOString() || null,
        // ── Form from standings ──
        form: formMapLegacy.get(t.name) || null,
        possession: null,
        passAccuracy: null,
        pressIntensity: null,
        style: null,
      }))

      return NextResponse.json({ teams, source: 'database', total: teams.length })
    }

    // ── 3. Final fallback: ESPN live fetch (no xG available) ──────────────
    console.log('[Teams] DB empty, falling back to ESPN')
    const leagueCode = league || 'PL'

    const [standingsData, teamsData] = await Promise.all([
      fetchStandings(leagueCode),
      fetchTeams(leagueCode),
    ])

    const logoMap = new Map<string, string>()
    for (const t of teamsData) {
      logoMap.set(t.name, t.logo)
      logoMap.set(t.abbreviation, t.logo)
    }

    if (standingsData.length > 0) {
      const teams = standingsData.map((s, i) => ({
        id: `espn-team-${s.code}-${i}`,
        name: s.team,
        code: s.code,
        logo: s.logo || logoMap.get(s.team) || logoMap.get(s.code) || '',
        primaryColor: '#00e676',
        secondaryColor: '#004d40',
        eloRating: 1500 + (s.points * 3) - (s.rank * 10),
        wins: s.wins, draws: s.draws, losses: s.losses,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst,
        playerCount: 0,
        // xG fields: honestly unavailable from ESPN
        xgPerGame: null, xgaPerGame: null, npxGPerGame: null,
        xgTruthClass: 'MISSING', xgSource: null, xgFreshness: null,
        // Form: derive from W/D/L in standings response
        form: (s.form || null),
        possession: null, passAccuracy: null, pressIntensity: null, style: null,
      }))

      return NextResponse.json({ teams, source: 'espn', total: teams.length })
    }

    if (teamsData.length > 0) {
      const teams = teamsData.map(t => ({
        id: `espn-team-${t.id}`,
        name: t.name,
        code: t.abbreviation,
        logo: t.logo,
        primaryColor: t.color || '#00e676',
        secondaryColor: '#004d40',
        eloRating: 1500,
        playerCount: 0,
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
