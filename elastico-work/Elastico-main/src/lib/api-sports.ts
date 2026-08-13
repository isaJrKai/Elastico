/**
 * ELASTICO — API-Sports Service (api-sports.io)
 *
 * Comprehensive football data: fixtures, live scores, odds, predictions,
 * standings, top scorers, head-to-head, injuries, transfers.
 * Free tier: 100 requests/day.
 */

const BASE = 'https://v3.football.api-sports.io'

function headers(): Record<string, string> {
  return { 'x-apisports-key': process.env.API_SPORTS_KEY || '' }
}

// ── League IDs (API-Sports v3) ────────────────────────────────────────────────

export const AS_LEAGUES = [
  { id: 39, code: 'PL', name: 'Premier League' },
  { id: 140, code: 'LIGA', name: 'La Liga' },
  { id: 135, code: 'SA', name: 'Serie A' },
  { id: 78, code: 'BL', name: 'Bundesliga' },
  { id: 61, code: 'L1', name: 'Ligue 1' },
  { id: 253, code: 'MLS', name: 'MLS' },
  { id: 2, code: 'UCL', name: 'Champions League' },
  { id: 3, code: 'UEL', name: 'Europa League' },
  { id: 88, code: 'ERE', name: 'Eredivisie' },
  { id: 94, code: 'PPL', name: 'Primeira Liga' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ASFixture {
  id: number
  date: string
  status: { short: string; long: string; elapsed: number | null }
  league: { id: number; name: string; country: string; logo: string; flag: string | null; season: number; round: string }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface ASPrediction {
  predictions: {
    winner: { id: number | null; name: string; comment: string }
    win_or_draw: boolean
    under_over: string
    advice: string
  }
  league: { id: number; name: string; country: string; logo: string }
  teams: {
    home: { id: number; name: string; logo: string; last_5: Record<string, string> }
    away: { id: number; name: string; logo: string; last_5: Record<string, string> }
  }
  comparison: {
    form: { home: string; away: string }
    att: { home: number; away: number }
    def: { home: number; away: number }
    pois_dist: { home: number; away: number }
    goals: { home: string; away: string }
    total: number
  }
  h2h: Array<{ goals: { home: number; away: number } }>
}

export interface ASStandingTeam {
  rank: number
  team: { id: number; name: string; logo: string }
  points: number
  goalsDiff: number
  form: string
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } }
  home: { played: number; win: number; draw: number; lose: number }
  away: { played: number; win: number; draw: number; lose: number }
}

export interface ASOdds {
  fixture: { id: number }
  bookmakers: Array<{
    id: number
    name: string
    bets: Array<{
      id: number
      name: string  // 'Match Winner', 'Handicap', 'Goals Over/Under', etc.
      values: Array<{
        value: string
        odd: number
        handicap?: string | null
      }>
    }>
  }>
}

export interface ASTopScorer {
  player: { id: number; name: string; firstname: string; lastname: string; age: number; nationality: string; height: string | null; weight: string | null; photo: string }
  statistics: Array<{
    team: { id: number; name: string; logo: string }
    league: { id: number; name: string; country: string; logo: string; season: number }
    games: { appearences: number; lineups: number; minutes: number }
    goals: { total: number; conceded: number; assists: number; saves: number }
    cards: { yellow: number; yellowred: number; red: number }
  }>
}

export interface ASHeadToHead {
  fixture: { id: number; date: string; status: { short: string } }
  league: { id: number; name: string; country: string; logo: string }
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } }
  goals: { home: number | null; away: number | null }
}

// ── API Calls ──────────────────────────────────────────────────────────────────

async function apiGet(endpoint: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE}${endpoint}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { headers: headers(), next: { revalidate: 120 } })
  if (!res.ok) throw new Error(`API-Sports ${res.status}: ${endpoint}`)
  return res.json()
}

/** Get current season fixtures for a league */
export async function fetchFixtures(leagueId: number, season?: number): Promise<ASFixture[]> {
  const year = season || new Date().getFullYear()
  const data = await apiGet('/fixtures', { league: String(leagueId), season: String(year) })
  return data.response || []
}

/** Get live fixtures across all configured leagues */
export async function fetchLiveFixtures(): Promise<ASFixture[]> {
  const data = await apiGet('/fixtures', { live: 'all' })
  return data.response || []
}

/** Get fixtures for today */
export async function fetchTodayFixtures(): Promise<ASFixture[]> {
  const data = await apiGet('/fixtures', { date: new Date().toISOString().split('T')[0] })
  return data.response || []
}

/** Get prediction for a specific fixture */
export async function fetchPrediction(fixtureId: number): Promise<ASPrediction | null> {
  const data = await apiGet('/predictions', { fixture: String(fixtureId) })
  return data.response?.[0] || null
}

/** Get standings for a league */
export async function fetchStandings(leagueId: number, season?: number): Promise<ASStandingTeam[][]> {
  const year = season || new Date().getFullYear()
  const data = await apiGet('/standings', { league: String(leagueId), season: String(year) })
  return data.response?.map((l: any) => l.league?.standings || []) || []
}

/** Get odds for a fixture */
export async function fetchOdds(fixtureId: number): Promise<ASOdds | null> {
  const data = await apiGet('/odds', { fixture: String(fixtureId) })
  return data.response?.[0] || null
}

/** Get odds for all fixtures of a league (current round) */
export async function fetchLeagueOdds(leagueId: number, season?: number): Promise<ASOdds[]> {
  const year = season || new Date().getFullYear()
  const data = await apiGet('/odds', { league: String(leagueId), season: String(year) })
  return data.response || []
}

/** Get top scorers for a league */
export async function fetchTopScorers(leagueId: number, season?: number): Promise<ASTopScorer[]> {
  const year = season || new Date().getFullYear()
  const data = await apiGet('/topscorers', { league: String(leagueId), season: String(year) })
  return data.response || []
}

/** Get head-to-head between two teams */
export async function fetchHeadToHead(h2h: string, limit = 10): Promise<ASHeadToHead[]> {
  const data = await apiGet('/fixtures/headtohead', { h2h, last: String(limit) })
  return data.response || []
}

/** Get injuries for a league */
export async function fetchInjuries(leagueId: number, season?: number): Promise<any[]> {
  const year = season || new Date().getFullYear()
  const data = await apiGet('/injuries', { league: String(leagueId), season: String(year) })
  return data.response || []
}

// ── Mapping Helpers ────────────────────────────────────────────────────────────

export function mapASStatus(short: string): string {
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

/** Normalize a fixture for the frontend */
export function normalizeASFixture(f: ASFixture) {
  return {
    id: `as:${f.id}`,
    competition: f.league?.name || 'Unknown',
    competitionCode: f.league?.country || '',
    competitionLogo: f.league?.logo || '',
    homeTeam: {
      id: String(f.teams?.home?.id || ''),
      name: f.teams?.home?.name || 'Unknown',
      abbreviation: f.teams?.home?.name?.substring(0, 3).toUpperCase() || '???',
      logo: f.teams?.home?.logo || '',
      color: '#ffffff',
    },
    awayTeam: {
      id: String(f.teams?.away?.id || ''),
      name: f.teams?.away?.name || 'Unknown',
      abbreviation: f.teams?.away?.name?.substring(0, 3).toUpperCase() || '???',
      logo: f.teams?.away?.logo || '',
      color: '#ffffff',
    },
    homeScore: f.goals?.home ?? 0,
    awayScore: f.goals?.away ?? 0,
    halfTimeHome: f.score?.halftime?.home ?? null,
    halfTimeAway: f.score?.halftime?.away ?? null,
    winner: f.teams?.home?.winner === true ? 'home' : f.teams?.away?.winner === true ? 'away' : 'draw',
    status: mapASStatus(f.status?.short || 'NS'),
    date: f.date,
    minute: f.status?.elapsed ?? undefined,
    round: f.league?.round || null,
  }
}

/** Extract odds from API-Sports response into a normalized format */
export function extractASOdds(odds: ASOdds) {
  const result: {
    matchWinner: { home: number | null; draw: number | null; away: number | null; source: string }
    handicaps: Array<{ line: string; home: number; away: number; source: string }>
    overUnder: Array<{ line: string; over: number; under: number; source: string }>
  } = {
    matchWinner: { home: null, draw: null, away: null, source: '' },
    handicaps: [],
    overUnder: [],
  }

  for (const bm of odds.bookmakers || []) {
    for (const bet of bm.bets || []) {
      if (bet.name === 'Match Winner' && !result.matchWinner.home) {
        const home = bet.values.find(v => v.value === 'Home')
        const draw = bet.values.find(v => v.value === 'Draw')
        const away = bet.values.find(v => v.value === 'Away')
        result.matchWinner = {
          home: home?.odd ?? null,
          draw: draw?.odd ?? null,
          away: away?.odd ?? null,
          source: bm.name,
        }
      }

      if (bet.name === 'Handicap' || bet.name === 'Asian Handicap') {
        for (const v of bet.values) {
          if (v.handicap) {
            result.handicaps.push({
              line: v.handicap,
              home: v.odd,
              away: v.odd, // simplified — real API has separate home/away
              source: bm.name,
            })
          }
        }
      }

      if (bet.name === 'Goals Over/Under') {
        for (const v of bet.values) {
          const over = v.value.startsWith('Over') ? v.odd : null
          const under = v.value.startsWith('Under') ? v.odd : null
          const line = v.value.replace(/^(Over|Under)\s*/, '')
          if (over || under) {
            result.overUnder.push({
              line,
              over: over || 0,
              under: under || 0,
              source: bm.name,
            })
          }
        }
      }
    }
    // Only take from first bookmaker that has match winner
    if (result.matchWinner.home) break
  }

  return result
}