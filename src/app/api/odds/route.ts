import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { rateLimit } from '@/lib/rate-limit'
/**
 * GET /api/odds?competition=PL&refresh=true
 *
 * DATA FLOW: API Key -> DB (OddsSnapshot) -> App
 *
 * 1. Serve from database (cached odds) by default
 * 2. If ?refresh=true OR DB is empty, fetch from APIs and persist
 * 3. TheOdds API data is ALWAYS saved because it has no historical endpoint
 * 4. Each snapshot is timestamped — building a historical odds record
 *
 * Sources (in priority order):
 *   - the-odds-api (bookmaker odds, 500 req/month free)
 *   - api-sports (fixture odds, 100 req/day free)
 *   - football-data.org (basic odds, 10 req/min free)
 */
export const dynamic = 'force-dynamic'

// ── Save TheOdds API data to DB ──────────────────────────────────────────
async function persistTheOddsToDb() {
  if (!process.env.THE_ODDS_API_KEY) return 0

  try {
    const { fetchSoccerOdds, extractTheOddsData } = await import('@/lib/the-odds-api')
    const rawOdds = await fetchSoccerOdds()
    if (rawOdds.length === 0) return 0

    const now = new Date()
    let saved = 0

    for (const o of rawOdds) {
      // Extract data from first bookmaker that has h2h
      let homeWin: number | null = null
      let draw: number | null = null
      let awayWin: number | null = null
      let bookmaker = ''
      let homeSpread: number | null = null
      let awaySpread: number | null = null
      let spreadLine = ''
      let over: number | null = null
      let under: number | null = null
      let totalLine = '2.5'

      for (const bm of o.bookmakers || []) {
        for (const market of bm.markets || []) {
          if (market.key === 'h2h' && !homeWin) {
            const h = market.outcomes.find(x => x.name === o.home_team)
            const d = market.outcomes.find(x => x.name === 'Draw')
            const a = market.outcomes.find(x => x.name === o.away_team)
            if (h && a) {
              homeWin = h.price > 0 ? (h.price / 100) + 1 : (100 / Math.abs(h.price)) + 1
              draw = d ? (d.price > 0 ? (d.price / 100) + 1 : (100 / Math.abs(d.price)) + 1) : null
              awayWin = a.price > 0 ? (a.price / 100) + 1 : (100 / Math.abs(a.price)) + 1
              bookmaker = bm.title
            }
          }
          if (market.key === 'spreads' && !homeSpread) {
            const h = market.outcomes.find(x => x.name === o.home_team)
            const a = market.outcomes.find(x => x.name === o.away_team)
            if (h && a) {
              homeSpread = h.price > 0 ? (h.price / 100) + 1 : (100 / Math.abs(h.price)) + 1
              awaySpread = a.price > 0 ? (a.price / 100) + 1 : (100 / Math.abs(a.price)) + 1
              spreadLine = String(h.point || 0)
              bookmaker = bm.title
            }
          }
          if (market.key === 'totals' && !over) {
            const ov = market.outcomes.find(x => x.name === 'Over')
            const un = market.outcomes.find(x => x.name === 'Under')
            if (ov && un) {
              over = ov.price > 0 ? (ov.price / 100) + 1 : (100 / Math.abs(ov.price)) + 1
              under = un.price > 0 ? (un.price / 100) + 1 : (100 / Math.abs(un.price)) + 1
              totalLine = String(ov.point || 2.5)
              bookmaker = bm.title
            }
          }
        }
        if (homeWin) break
      }

      try {
        await db.oddsSnapshot.create({
          data: {
            externalId: o.id,
            source: 'the-odds-api',
            sportKey: o.sport_key,
            homeTeam: o.home_team,
            awayTeam: o.away_team,
            commenceTime: o.commence_time ? new Date(o.commence_time) : null,
            homeWinOdds: homeWin,
            drawOdds: draw,
            awayWinOdds: awayWin,
            bookmaker,
            homeSpreadOdds: homeSpread,
            awaySpreadOdds: awaySpread,
            spreadLine: spreadLine || null,
            overOdds: over,
            underOdds: under,
            totalLine,
            rawData: JSON.stringify(o.bookmakers?.slice(0, 3) || []),
            fetchedAt: now,
          },
        })
        saved++
      } catch {
        // Duplicate — already saved this snapshot
      }
    }

    console.log(`[Odds/DB] Saved ${saved} odds snapshots from TheOdds API`)
    return saved
  } catch (err) {
    console.error('[Odds/DB] TheOdds persist failed:', err)
    return 0
  }
}

// ── Save API-Sports odds to DB ──────────────────────────────────────────
async function persistApiSportsOddsToDb(competition: string) {
  if (!process.env.API_SPORTS_KEY) return 0

  try {
    const { fetchLeagueOdds, extractASOdds, fetchFixtures, AS_LEAGUES } = await import('@/lib/api-sports')
    const league = AS_LEAGUES.find(l => l.code === competition)
    if (!league) return 0

    // API-Sports odds don't include team names, so we fetch fixtures to cross-reference
    const [odds, fixtures] = await Promise.all([
      fetchLeagueOdds(league.id),
      fetchFixtures(league.id),
    ])
    if (odds.length === 0) return 0

    // Build fixture ID -> team names mapping
    const fixtureMap = new Map<number, { home: string; away: string; date: string }>()
    for (const f of fixtures) {
      fixtureMap.set(f.id, {
        home: f.teams?.home?.name || '',
        away: f.teams?.away?.name || '',
        date: f.date || '',
      })
    }

    const now = new Date()
    let saved = 0

    for (const o of odds) {
      const extracted = extractASOdds(o)
      if (!extracted.matchWinner.home) continue

      const fixtureInfo = fixtureMap.get(o.fixture?.id || 0)
      const homeTeam = fixtureInfo?.home || `Fixture #${o.fixture?.id}`
      const awayTeam = fixtureInfo?.away || ''

      try {
        await db.oddsSnapshot.create({
          data: {
            externalId: String(o.fixture?.id || ''),
            source: 'api-sports',
            sportKey: `soccer_${competition.toLowerCase()}`,
            homeTeam,
            awayTeam,
            commenceTime: fixtureInfo?.date ? new Date(fixtureInfo.date) : null,
            homeWinOdds: extracted.matchWinner.home,
            drawOdds: extracted.matchWinner.draw,
            awayWinOdds: extracted.matchWinner.away,
            bookmaker: extracted.matchWinner.source,
            homeSpreadOdds: extracted.handicaps[0]?.home || null,
            awaySpreadOdds: extracted.handicaps[0]?.away || null,
            spreadLine: extracted.handicaps[0]?.line || null,
            overOdds: extracted.overUnder[0]?.over || null,
            underOdds: extracted.overUnder[0]?.under || null,
            totalLine: extracted.overUnder[0]?.line || null,
            fetchedAt: now,
          },
        })
        saved++
      } catch {
        // Duplicate
      }
    }

    console.log(`[Odds/DB] Saved ${saved} odds from API-Sports for ${competition}`)
    return saved
  } catch (err) {
    console.error('[Odds/DB] API-Sports persist failed:', err)
    return 0
  }
}

// ── Save football-data.org odds to DB ──────────────────────────────────
async function persistFootballDataOddsToDb(competition: string) {
  if (!process.env.FOOTBALL_DATA_API_KEY) return 0

  try {
    const { fetchMatchesWithOdds, FD_COMPETITIONS } = await import('@/lib/football-data-org')
    const fdEntry = FD_COMPETITIONS.find(c => c.code === competition)
    const fdCode = fdEntry ? fdEntry.fdCode : competition

    const matches = await fetchMatchesWithOdds(fdCode)
    if (matches.length === 0) return 0

    const now = new Date()
    let saved = 0

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
        saved++
      } catch {
        // Duplicate
      }
    }

    console.log(`[Odds/DB] Saved ${saved} odds from football-data.org for ${competition}`)
    return saved
  } catch (err) {
    console.error('[Odds/DB] football-data.org persist failed:', err)
    return 0
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`odds:${ip}`, 10, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const competition = searchParams.get('competition') || 'PL'
    const refresh = searchParams.get('refresh') === 'true'
    const sportFilter = `soccer_${competition.toLowerCase()}`

    // ── Refresh from APIs if requested or DB is empty ─────────────────────
    if (refresh) {
      console.log(`[Odds] Refresh requested for ${competition}`)
      const [toCount, asCount, fdCount] = await Promise.all([
        persistTheOddsToDb(),
        persistApiSportsOddsToDb(competition),
        persistFootballDataOddsToDb(competition),
      ])
      console.log(`[Odds] Persisted: TheOdds=${toCount}, API-Sports=${asCount}, FD=${fdCount}`)
    }

    // ── Serve from DATABASE ─────────────────────────────────────────────
    // Get latest snapshot per external event (most recent fetchedAt)
    const latestSnapshots = await db.oddsSnapshot.findMany({
      where: {
        OR: [
          { sportKey: sportFilter },
          { sportKey: 'soccer' }, // TheOdds uses 'soccer' for all
        ],
        commenceTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // last 7 days
      },
      orderBy: { fetchedAt: 'desc' },
      take: 100,
    })

    // If DB is empty, trigger a background refresh and return what we get
    if (latestSnapshots.length === 0 && !refresh) {
      console.log('[Odds] DB empty, triggering background refresh...')
      const [toCount] = await Promise.all([
        persistTheOddsToDb(),
      ])
      if (toCount > 0) {
        const refreshed = await db.oddsSnapshot.findMany({
          orderBy: { fetchedAt: 'desc' },
          take: 100,
        })
        return NextResponse.json({
          success: true,
          competition,
          count: refreshed.length,
          source: 'database (auto-refreshed)',
          data: refreshed.map(formatSnapshot),
        })
      }
    }

    // Deduplicate: keep only latest snapshot per externalId
    const seen = new Set<string>()
    const unique = latestSnapshots.filter(s => {
      if (seen.has(s.externalId)) return false
      seen.add(s.externalId)
      return true
    })

    return NextResponse.json({
      success: true,
      competition,
      count: unique.length,
      source: 'database',
      data: unique.map(formatSnapshot),
    })
  } catch (error) {
    console.error('[Odds] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}

function formatSnapshot(s: any) {
  return {
    id: s.id,
    source: s.source,
    sportKey: s.sportKey,
    homeTeam: s.homeTeam,
    awayTeam: s.awayTeam,
    commenceTime: s.commenceTime?.toISOString() || null,
    matchWinner: (s.homeWinOdds || s.awayWinOdds) ? {
      home: s.homeWinOdds,
      draw: s.drawOdds,
      away: s.awayWinOdds,
      bookmaker: s.bookmaker,
    } : null,
    spread: (s.homeSpreadOdds || s.awaySpreadOdds) ? {
      home: s.homeSpreadOdds,
      away: s.awaySpreadOdds,
      line: s.spreadLine,
      bookmaker: s.bookmaker,
    } : null,
    total: (s.overOdds || s.underOdds) ? {
      over: s.overOdds,
      under: s.underOdds,
      line: s.totalLine,
      bookmaker: s.bookmaker,
    } : null,
    fetchedAt: s.fetchedAt?.toISOString() || null,
  }
}