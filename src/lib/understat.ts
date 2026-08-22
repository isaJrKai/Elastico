/**
 * ELASTICO — Understat Service
 *
 * Understat provides xG, shot maps, and deep match analytics for
 * the top 5 European leagues (PL, La Liga, Bundesliga, Serie A, Ligue 1).
 *
 * IMPORTANT: Understat changed their site architecture (Aug 2025). The old
 * HTML-embedded JSON parsing no longer works. They now use AJAX endpoints:
 *   /getLeagueData/{league}/{season} — returns {teams, players, dates}
 *   /getTeamData/{id}/{season} — team match history
 *   /getMatchData/{id} — match shots with xG
 *
 * LIMITATIONS:
 * - Understat rate-limits aggressively (2-3 requests then 404s)
 * - The new /getLeagueData endpoint does NOT return team-level xG/xGA.
 *   Match-level xG is available via /getMatchData but is rate-limited.
 * - This scraper is best used via infrequent cron syncs, not live requests.
 *
 * Data source: understat.com — AJAX endpoints.
 * Server-side only. No API key needed.
 */

const BASE = 'https://understat.com'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UnderstatShot {
  id: number
  minute: number
  result: string       // Goal, MissedShot, SavedShot, BlockedShot, ShotOnPost
  X: number            // 0–1 normalized x coordinate
  Y: number            // 0–1 normalized y coordinate
  xG: number
  player: string
  homeTeam: string
  awayTeam: string
  situation: string    // OpenPlay, FromCorner, DirectFreekick, SetPiece, Penalty
  shotType: string     // RightFoot, LeftFoot, Head, OtherBodyPart
  player_assisted: string | null
  lastAction: string
}

export interface UnderstatMatch {
  id: number
  date: string
  home_team: string
  away_team: string
  home_goals: number
  away_goals: number
  home_xG: number
  away_xG: number
  forecast_w: number
  forecast_d: number
  forecast_l: number
  url: string
  match_info: any
  shots: { h: UnderstatShot[]; a: UnderstatShot[] }
}

// Team data from new /getLeagueData endpoint
export interface UnderstatTeamData {
  id: number
  title: string
  short_title?: string
  team_name?: string
  history?: any[]
  // Note: xG/xGA/ppda are NOT in the new API response.
  // They must be computed from match-level data or from the team page.
}

export interface UnderstatPlayer {
  id: number
  player_name: string
  games: number
  time: number
  goals: number
  xG: number
  assists: number
  xA: number
  shots: number
  key_passes: number
  yellow_cards: number
  red_cards: number
  position: string
  team_title: string
  npg: number
  npxG: number
  xGChain: number
  xGBuildup: number
}

// ── League code mapping ────────────────────────────────────────────────────────────

const LEAGUE_SLUGS: Record<string, string> = {
  'PL': 'EPL',
  'LIGA': 'La_Liga',
  'SA': 'Serie_A',
  'BL': 'Bundesliga',
  'L1': 'Ligue_1',
}

function toUnderstatLeague(code: string): string {
  return LEAGUE_SLUGS[code.toUpperCase()] || code
}

// ── Fetch helper ─────────────────────────────────────────────────────────────────

const fetchCache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 3600000 // 1 hour

async function understatFetch(url: string, label: string): Promise<any | null> {
  try {
    // Check memory cache
    const cached = fetchCache.get(url)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return cached.data
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://understat.com/`,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!res.ok) {
      console.warn(`[Understat] ${label}: HTTP ${res.status}`)
      return null
    }

    const data = await res.json()

    // Cache successful responses
    fetchCache.set(url, { data, ts: Date.now() })
    return data
  } catch (err) {
    console.error(`[Understat] ${label}:`, err)
    return null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────────────

/**
 * Get league team data from Understat.
 * NOTE: The new API does NOT return xG/xGA/ppda at the team level.
 * These metrics must be accumulated from match-level data.
 *
 * Returns team IDs and names for entity resolution.
 */
export async function fetchLeagueTeams(leagueCode: string, seasonYear?: number): Promise<UnderstatTeamData[]> {
  const slug = toUnderstatLeague(leagueCode)
  const year = seasonYear || 2024
  const url = `${BASE}/getLeagueData/${slug}/${year}`
  const data = await understatFetch(url, `fetchLeagueTeams(${slug}/${year})`)

  if (!data?.teams) return []

  const teams: UnderstatTeamData[] = []
  for (const [idStr, teamData] of Object.entries(data.teams)) {
    const t = teamData as any
    teams.push({
      id: parseInt(idStr),
      title: t.title || '',
      short_title: t.short_title || '',
      team_name: t.team_name || t.title || '',
      history: t.history || [],
    })
  }
  return teams
}

/**
 * Get match-level xG data.
 * This is the ONLY source of real xG from Understat.
 * RATE LIMITED: Use sparingly (2-3 requests per session max).
 */
export async function fetchMatch(matchId: number): Promise<UnderstatMatch | null> {
  const url = `${BASE}/getMatchData/${matchId}`
  const data = await understatFetch(url, `fetchMatch(${matchId})`)
  if (!data) return null

  const shotsData = data.shots || { h: [], a: [] }
  const matchData = data.tmpl || {}

  return {
    id: matchId,
    date: matchData.date || '',
    home_team: matchData.h?.title || '',
    away_team: matchData.a?.title || '',
    home_goals: parseInt(matchData.h?.goals) || 0,
    away_goals: parseInt(matchData.a?.goals) || 0,
    home_xG: parseFloat(matchData.h?.xG) || 0,
    away_xG: parseFloat(matchData.a?.xG) || 0,
    forecast_w: parseFloat(matchData.h?.forecast_w) || 0,
    forecast_d: parseFloat(matchData.forecast_d) || 0,
    forecast_l: parseFloat(matchData.a?.forecast_w) || 0,
    url: `${BASE}/match/${matchId}/`,
    match_info: matchData,
    shots: {
      h: (shotsData.h || []).map((s: any) => ({
        id: s.id || 0,
        minute: parseInt(s.minute) || 0,
        result: s.result || 'Unknown',
        X: parseFloat(s.X) || 0,
        Y: parseFloat(s.Y) || 0,
        xG: parseFloat(s.xG) || 0,
        player: s.player || '',
        homeTeam: matchData.h?.title || '',
        awayTeam: matchData.a?.title || '',
        situation: s.situation || '',
        shotType: s.shotType || '',
        player_assisted: s.player_assisted || null,
        lastAction: s.lastAction || '',
      })),
      a: (shotsData.a || []).map((s: any) => ({
        id: s.id || 0,
        minute: parseInt(s.minute) || 0,
        result: s.result || 'Unknown',
        X: parseFloat(s.X) || 0,
        Y: parseFloat(s.Y) || 0,
        xG: parseFloat(s.xG) || 0,
        player: s.player || '',
        homeTeam: matchData.h?.title || '',
        awayTeam: matchData.a?.title || '',
        situation: s.situation || '',
        shotType: s.shotType || '',
        player_assisted: s.player_assisted || null,
        lastAction: s.lastAction || '',
      })),
    },
  }
}

/**
 * Get league player stats (xG, xA, xGChain, xGBuildup).
 * Uses POST /main/getPlayersStats/ endpoint.
 */
export async function fetchLeaguePlayers(leagueCode: string, seasonYear?: number): Promise<UnderstatPlayer[]> {
  const slug = toUnderstatLeague(leagueCode)
  const year = seasonYear || 2024

  // Use the new POST endpoint
  try {
    const res = await fetch(`${BASE}/main/getPlayersStats/`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://understat.com/league/${slug}/${year}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `league=${slug}&season=${year}`,
    })

    if (!res.ok) {
      console.warn(`[Understat] fetchLeaguePlayers: HTTP ${res.status}`)
      return []
    }

    const data = await res.json()
    if (!data) return []

    // The response structure may vary; handle both array and object formats
    const players: UnderstatPlayer[] = []
    const playerData = Array.isArray(data) ? data : (data.players || [])

    for (const p of playerData) {
      players.push({
        id: parseInt(p.id) || 0,
        player_name: p.player_name || '',
        games: parseInt(p.games) || 0,
        time: parseInt(p.time) || 0,
        goals: parseInt(p.goals) || 0,
        xG: parseFloat(p.xG) || 0,
        assists: parseInt(p.assists) || 0,
        xA: parseFloat(p.xA) || 0,
        shots: parseInt(p.shots) || 0,
        key_passes: parseInt(p.key_passes) || 0,
        yellow_cards: parseInt(p.yellow_cards) || 0,
        red_cards: parseInt(p.red_cards) || 0,
        position: p.position || 'Unknown',
        team_title: p.team_title || '',
        npg: parseInt(p.npg) || 0,
        npxG: parseFloat(p.npxG) || 0,
        xGChain: parseFloat(p.xGChain) || 0,
        xGBuildup: parseFloat(p.xGBuildup) || 0,
      })
    }

    players.sort((a, b) => b.xG - a.xG)
    return players
  } catch (err) {
    console.error('[Understat] fetchLeaguePlayers:', err)
    return []
  }
}

/**
 * Get team match history with xG data for a season.
 */
export async function fetchTeamMatches(teamId: number, seasonYear?: number): Promise<any[]> {
  const year = seasonYear || 2024
  const url = `${BASE}/getTeamData/${teamId}/${year}`
  const data = await understatFetch(url, `fetchTeamMatches(${teamId}/${year})`)
  if (!data?.dates) return []

  const matches: any[] = []
  for (const [dateStr, dateMatches] of Object.entries(data.dates)) {
    if (Array.isArray(dateMatches)) {
      for (const m of dateMatches) {
        matches.push({ ...m, date: dateStr })
      }
    }
  }
  return matches
}

/**
 * Normalize an Understat shot to ELASTICO shot map format
 */
export type ShotSide = 'home' | 'away'

export function normalizeUnderstatShot(
  shot: UnderstatShot,
  side: 'home' | 'away',
) {
  const px = side === 'home' ? shot.X * 100 : (1 - shot.X) * 100
  const py = shot.Y * 100

  return {
    x: px,
    y: py,
    team: side,
    goal: shot.result === 'Goal',
    xg: shot.xG,
    player: shot.player,
    minute: shot.minute,
    outcome: shot.result,
    situation: shot.situation,
  }
}

/**
 * Build per-game xG averages from match history.
 * Since the new API doesn't provide team-level xG, we must
 * accumulate from individual match data.
 */
export async function computeTeamXgFromMatches(
  teamId: number,
  seasonYear: number,
): Promise<{
    matchesPlayed: number
    totalXg: number
    totalXga: number
    npxG: number
    npxGA: number
  } | null> {
  const matches = await fetchTeamMatches(teamId, seasonYear)
  if (matches.length === 0) return null

  let totalXg = 0, totalXga = 0, npxG = 0, npxGA = 0
  let matchesPlayed = 0

  for (const m of matches) {
    const isHome = String(m.h?.id) === String(teamId)
    const xg = isHome ? parseFloat(m.h?.xG) : parseFloat(m.a?.xG) || 0
    const xga = isHome ? parseFloat(m.a?.xG) : parseFloat(m.h?.xG) || 0

    if (xg > 0 || xga > 0) {
      totalXg += xg
      totalXga += xga
      matchesPlayed++
    }
  }

  if (matchesPlayed === 0) return null

  return {
    matchesPlayed,
    totalXg: Math.round(totalXg * 100) / 100,
    totalXga: Math.round(totalXga * 100) / 100,
    npxG: Math.round(npxG * 100) / 100,
    npxGA: Math.round(npxGA * 100) / 100,
  }
}

/**
 * Data freshness: when was the Understat data last updated?
 * Returns null if we can't determine.
 */
export function getDataFreshness(): { season: string; lastChecked: string; status: string } {
  // Understat covers current and previous seasons
  const currentYear = new Date().getFullYear()
  return {
    season: String(currentYear),
    lastChecked: new Date().toISOString(),
    status: 'AVAILABLE',
  }
}
