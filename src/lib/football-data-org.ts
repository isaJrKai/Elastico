/**
 * ELASTICO — Football-Data.org Service
 *
 * Free tier: 10 requests/minute.
 * Covers: PL, La Liga, Serie A, Bundesliga, Ligue 1, Champions League,
 * Europa League, Eredivisie, Primeira Liga, Bundesliga 2.
 * Provides: competitions, standings, matches, odds, scorers.
 */

const BASE = 'https://api.football-data.org/v4'

function headers(): Record<string, string> {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) return { 'X-Auth-Token': '' }
  return { 'X-Auth-Token': key }
}

// ── Competition Codes (football-data.org) ──────────────────────────────────────

export const FD_COMPETITIONS = [
  { code: 'PL', fdCode: 'PL', name: 'Premier League' },
  { code: 'PD', fdCode: 'PD', name: 'La Liga' },
  { code: 'SA', fdCode: 'SA', name: 'Serie A' },
  { code: 'BL1', fdCode: 'BL1', name: 'Bundesliga' },
  { code: 'FL1', fdCode: 'FL1', name: 'Ligue 1' },
  { code: 'CL', fdCode: 'CL', name: 'Champions League' },
  { code: 'EL', fdCode: 'EL', name: 'Europa League' },
  { code: 'DED', fdCode: 'DED', name: 'Eredivisie' },
  { code: 'PPL', fdCode: 'PPL', name: 'Primeira Liga' },
  { code: 'BL2', fdCode: 'BL2', name: '2. Bundesliga' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FDStandingTeam {
  position: number
  team: {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
  }
  playedGames: number
  form: string | null  // e.g. "W,D,W,L,W"
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface FDStanding {
  stage: string
  type: string
  table: FDStandingTeam[]
}

export interface FDMatch {
  id: number
  utcDate: string
  status: string  // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED, CANCELLED, SUSPENDED
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
  score: {
    halfTime: { home: number | null; away: number | null }
    fullTime: { home: number | null; away: number | null }
    winner: string | null
  }
  matchday: number | null
  competition: { id: number; name: string; code: string; emblem: string }
  odds: {
    msg: string
    matchWinner: { home: string; draw: string; away: string } | null
    doubleChance: { home: string; draw: string; away: string } | null
    overUnder: string | null
    asianHandicap: { home: string; away: string } | null
  } | null
}

export interface FDOddsMatch extends FDMatch {
  odds: NonNullable<FDMatch['odds']>
}

export interface FDCompetition {
  id: number
  name: string
  code: string
  type: string
  emblem: string
  currentSeason: {
    id: number
    startDate: string
    endDate: string
    currentMatchday: number | null
    winner: string | null
  } | null
}

// ── API Calls ──────────────────────────────────────────────────────────────────

/** Fetch all available competitions */
export async function fetchCompetitions(): Promise<FDCompetition[]> {
  try {
    const res = await fetch(`${BASE}/competitions`, {
      headers: headers(),
      next: { revalidate: 3600 }, // cache 1 hour
    })
    if (!res.ok) {
      console.error(`[football-data.org] Competitions error: ${res.status}`)
      return []
    }
    const data = await res.json()
    return data.competitions || []
  } catch (err) {
    console.error('[football-data.org] Competitions fetch failed:', err)
    return []
  }
}

/** Fetch standings for a competition */
export async function fetchStandings(competitionCode: string): Promise<FDStanding[]> {
  try {
    const res = await fetch(`${BASE}/competitions/${competitionCode}/standings`, {
      headers: headers(),
      next: { revalidate: 300 }, // cache 5 min
    })
    if (!res.ok) {
      console.error(`[football-data.org] Standings error ${res.status} for ${competitionCode}`)
      return []
    }
    const data = await res.json()
    return data.standings || []
  } catch (err) {
    console.error(`[football-data.org] Standings fetch failed for ${competitionCode}:`, err)
    return []
  }
}

/** Fetch matches for a competition (current matchday or specific) */
export async function fetchMatches(
  competitionCode: string,
  matchday?: number,
  statusFilter?: string
): Promise<FDMatch[]> {
  try {
    let url = `${BASE}/competitions/${competitionCode}/matches`
    const params: string[] = []
    if (matchday) params.push(`matchday=${matchday}`)
    if (statusFilter) params.push(`status=${statusFilter}`)
    if (params.length > 0) url += '?' + params.join('&')

    const res = await fetch(url, {
      headers: headers(),
      next: { revalidate: 120 }, // cache 2 min
    })
    if (!res.ok) {
      console.error(`[football-data.org] Matches error ${res.status} for ${competitionCode}`)
      return []
    }
    const data = await res.json()
    return data.matches || []
  } catch (err) {
    console.error(`[football-data.org] Matches fetch failed for ${competitionCode}:`, err)
    return []
  }
}

/** Fetch matches with odds (only available on paid tier, graceful fallback) */
export async function fetchMatchesWithOdds(competitionCode: string): Promise<FDMatch[]> {
  try {
    const res = await fetch(`${BASE}/competitions/${competitionCode}/matches?status=SCHEDULED,TIMED`, {
      headers: headers(),
      next: { revalidate: 120 },
    })
    if (!res.ok) return []

    const data = await res.json()
    const matches: FDMatch[] = data.matches || []

    // Filter to matches that have odds data (free tier may not include odds)
    return matches.filter((m: FDMatch) => m.odds && m.odds.matchWinner)
  } catch (err) {
    console.error('[football-data.org] Odds fetch failed:', err)
    return []
  }
}

/** Fetch top scorers for a competition */
export async function fetchScorers(competitionCode: string, limit = 10): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/competitions/${competitionCode}/scorers?limit=${limit}`, {
      headers: headers(),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.scorers || []
  } catch (err) {
    console.error(`[football-data.org] Scorers fetch failed for ${competitionCode}:`, err)
    return []
  }
}

/** Fetch all today's matches across all competitions */
export async function fetchTodaysMatches(): Promise<FDMatch[]> {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const res = await fetch(`${BASE}/matches?dateFrom=${today}&dateTo=${today}`, {
      headers: headers(),
      next: { revalidate: 60 }, // cache 1 min for live freshness
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.matches || []
  } catch (err) {
    console.error('[football-data.org] Today matches failed:', err)
    return []
  }
}

// ── Mapping Helpers ────────────────────────────────────────────────────────────

export function mapFDStatus(fdStatus: string): string {
  const map: Record<string, string> = {
    'SCHEDULED': 'upcoming',
    'TIMED': 'upcoming',
    'IN_PLAY': 'live',
    'PAUSED': 'halftime',
    'FINISHED': 'finished',
    'POSTPONED': 'postponed',
    'CANCELLED': 'postponed',
    'SUSPENDED': 'postponed',
  }
  return map[fdStatus] || 'upcoming'
}

/** Map football-data.org match to a normalized format */
export function normalizeFDMatch(m: FDMatch) {
  return {
    id: `fd:${m.id}`,
    competition: m.competition?.name || 'Unknown',
    competitionCode: m.competition?.code || '',
    competitionEmblem: m.competition?.emblem || '',
    homeTeam: {
      id: String(m.homeTeam?.id || ''),
      name: m.homeTeam?.name || 'Unknown',
      abbreviation: m.homeTeam?.tla || '???',
      logo: m.homeTeam?.crest || '',
      color: '#ffffff',
    },
    awayTeam: {
      id: String(m.awayTeam?.id || ''),
      name: m.awayTeam?.name || 'Unknown',
      abbreviation: m.awayTeam?.tla || '???',
      logo: m.awayTeam?.crest || '',
      color: '#ffffff',
    },
    homeScore: m.score?.fullTime?.home ?? 0,
    awayScore: m.score?.fullTime?.away ?? 0,
    halfTimeHome: m.score?.halfTime?.home ?? null,
    halfTimeAway: m.score?.halfTime?.away ?? null,
    winner: m.score?.winner || null,
    status: mapFDStatus(m.status),
    date: m.utcDate,
    matchday: m.matchday,
    odds: m.odds ? {
      homeWin: m.odds.matchWinner?.home || null,
      draw: m.odds.matchWinner?.draw || null,
      awayWin: m.odds.matchWinner?.away || null,
      doubleChance: m.odds.doubleChance,
      overUnder: m.odds.overUnder,
      asianHandicap: m.odds.asianHandicap,
    } : null,
  }
}