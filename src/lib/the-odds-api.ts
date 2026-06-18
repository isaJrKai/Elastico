/**
 * ELASTICO — TheOdds API Service
 *
 * Real bookmaker odds from multiple sportsbooks.
 * Covers: match winner, spreads (Asian handicap), totals (over/under),
 * moneylines, h2h.
 * Free tier: 500 requests/month.
 */

const BASE = 'https://api.the-odds-api.com/v4'

function apiKey(): string {
  return process.env.THE_ODDS_API_KEY || ''
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TOOdds {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Array<{
    key: string
    title: string
    last_update: string
    markets: Array<{
      key: string  // 'h2h', 'spreads', 'totals'
      outcomes: Array<{
        name: string
        price: number  // American odds
        point?: number  // for spreads/totals
      }>
    }>
  }>
}

// ── API Calls ──────────────────────────────────────────────────────────────────

/** Get odds for a specific soccer league */
export async function fetchSoccerOdds(
  leagueKey?: string,
  regions = 'eu,us,uk',
  markets = 'h2h,spreads,totals'
): Promise<TOOdds[]> {
  const key = apiKey()
  if (!key) return []

  let sport = 'soccer'
  if (leagueKey) sport = `soccer_${leagueKey}`

  const params = new URLSearchParams({
    apiKey: key,
    regions,
    markets,
  })

  // Odds change rapidly — minimal caching
  try {
    const res = await fetch(`${BASE}/sports/${sport}/odds/?${params}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) {
      console.error(`[TheOdds] Error ${res.status} for ${sport}`)
      return []
    }
    return res.json()
  } catch (err) {
    console.error('[TheOdds] Fetch failed:', err)
    return []
  }
}

/** Get odds for all major soccer leagues */
export async function fetchAllSoccerOdds(): Promise<TOOdds[]> {
  const key = apiKey()
  if (!key) return []

  try {
    const params = new URLSearchParams({
      apiKey: key,
      regions: 'eu,us,uk',
      markets: 'h2h,spreads,totals',
    })
    const res = await fetch(`${BASE}/sports/soccer/odds/?${params}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    return res.json()
  } catch (err) {
    console.error('[TheOdds] All soccer odds failed:', err)
    return []
  }
}

// ── Mapping Helpers ────────────────────────────────────────────────────────────

/** Convert American odds to decimal */
function americanToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

/** Extract normalized odds from TheOdds response */
export function extractTheOddsData(odds: TOOdds[]) {
  return odds.map(o => {
    let matchWinner: { home: number; draw: number; away: number; source: string } | null = null
    let spread: { home: number; away: number; line: string; source: string } | null = null
    let total: { over: number; under: number; line: string; source: string } | null = null

    for (const bm of o.bookmakers || []) {
      for (const market of bm.markets || []) {
        if (market.key === 'h2h' && !matchWinner) {
          const home = market.outcomes.find(x => x.name === o.home_team)
          const draw = market.outcomes.find(x => x.name === 'Draw')
          const away = market.outcomes.find(x => x.name === o.away_team)
          if (home && away) {
            matchWinner = {
              home: americanToDecimal(home.price),
              draw: draw ? americanToDecimal(draw.price) : 0,
              away: americanToDecimal(away.price),
              source: bm.title,
            }
          }
        }

        if (market.key === 'spreads' && !spread) {
          const homeLine = market.outcomes.find(x => x.name === o.home_team)
          const awayLine = market.outcomes.find(x => x.name === o.away_team)
          if (homeLine && awayLine) {
            spread = {
              home: americanToDecimal(homeLine.price),
              away: americanToDecimal(awayLine.price),
              line: String(homeLine.point || 0),
              source: bm.title,
            }
          }
        }

        if (market.key === 'totals' && !total) {
          const overLine = market.outcomes.find(x => x.name === 'Over')
          const underLine = market.outcomes.find(x => x.name === 'Under')
          if (overLine && underLine) {
            total = {
              over: americanToDecimal(overLine.price),
              under: americanToDecimal(underLine.price),
              line: String(overLine.point || 2.5),
              source: bm.title,
            }
          }
        }
      }
      // Take first bookmaker that has data
      if (matchWinner) break
    }

    return {
      id: `to:${o.id}`,
      sport: o.sport_key,
      homeTeam: o.home_team,
      awayTeam: o.away_team,
      commenceTime: o.commence_time,
      matchWinner,
      spread,    // This is the Asian handicap equivalent
      total,     // Over/Under
    }
  })
}