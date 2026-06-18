/**
 * ELASTICO — Understat Service
 *
 * Understat provides xG, shot maps, and deep match analytics for
 * the top 5 European leagues (PL, La Liga, Bundesliga, Serie A, Ligue 1).
 *
 * Data source: understat.com — parsed from HTML/JSON embedded in pages.
 * Server-side only (uses raw fetch to scrape Understat pages).
 *
 * Leagues:
 *   EPL = Premier League
 *   La_Liga = La Liga
 *   Bundesliga = Bundesliga
 *   Serie_A = Serie A
 *   Ligue_1 = Ligue 1
 */

const BASE = 'https://understat.com'

interface UnderstatResponse {
  success: boolean
  data?: any
  error?: string
}

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
  lastAction: string   // Pass, Cross, HeadPass, etc.
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

export interface UnderstatTeamSeason {
  id: number
  title: string
  short_title: string
  team_name: string
  wins: number
  draws: number
  losses: number
  scored: number
  missed: number
  pts: number
  xG: number
  npxG: number
  xGA: number
  npxGA: number
  npxGD: number
  ppda: { att: number; def: number }
  ppda_allowed: { att: number; def: number }
  deep: number
  deep_allowed: number
  xpts: number
  xpts_diff: number
  matches: any[]
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

// ── Fetch helpers ─────────────────────────────────────────────────────────────

/**
 * Understat embeds JSON data in a <script> tag with JSON.parse().
 * We extract it by matching the pattern.
 */
async function fetchUnderstatJSON(url: string, label: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 3600 }, // Cache 1 hour
    })
    if (!res.ok) {
      console.warn(`[Understat] ${label}: HTTP ${res.status}`)
      return null
    }
    const html = await res.text()

    // Extract JSON from: var data = JSON.parse('...') or similar patterns
    // Understat uses: datesData="<JSON>", teamsData="<JSON>", playersData="<JSON>"
    // Also match data is embedded as: var matchesData = JSON.parse('...')
    const jsonPatterns = [
      /(\w+Data)\s*=\s*JSON\.parse\('(.+?)'\);/g,
      /JSON\.parse\('(.+?)'\)/g,
    ]

    // Try the named data pattern first
    const namedMatch = [...html.matchAll(/(\w+Data)\s*=\s*JSON\.parse\('(.+?)'\);/g)]
    if (namedMatch.length > 0) {
      const result: Record<string, any> = {}
      for (const m of namedMatch) {
        try {
          result[m[1]] = JSON.parse(m[2].replace(/\\'/g, "'"))
        } catch {
          // skip malformed
        }
      }
      return result
    }

    // Fallback: try raw JSON parse from inline data
    const rawMatch = html.match(/JSON\.parse\('(.+?)'\)/)
    if (rawMatch) {
      try {
        return JSON.parse(rawMatch[1].replace(/\\'/g, "'"))
      } catch {
        return null
      }
    }

    console.warn(`[Understat] ${label}: No JSON data found in page`)
    return null
  } catch (err) {
    console.error(`[Understat] ${label}:`, err)
    return null
  }
}

// ── League code mapping ────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get league team stats (xG, xGA, ppda, etc.) for a season
 */
export async function fetchLeagueTeams(leagueCode: string, seasonYear?: number): Promise<UnderstatTeamSeason[]> {
  const slug = toUnderstatLeague(leagueCode)
  const year = seasonYear || 2024
  const url = `${BASE}/league/${slug}/${year}`
  const data = await fetchUnderstatJSON(url, `fetchLeagueTeams(${slug}/${year})`)
  if (!data?.teamsData) return []

  const teams: UnderstatTeamSeason[] = []
  for (const [idStr, teamData] of Object.entries(data.teamsData)) {
    const t = teamData as any
    teams.push({
      id: parseInt(idStr),
      title: t.title,
      short_title: t.short_title,
      team_name: t.team_name,
      wins: parseInt(t.wins) || 0,
      draws: parseInt(t.draws) || 0,
      losses: parseInt(t.losses) || 0,
      scored: parseInt(t.scored) || 0,
      missed: parseInt(t.missed) || 0,
      pts: parseInt(t.pts) || 0,
      xG: parseFloat(t.xG) || 0,
      npxG: parseFloat(t.npxG) || 0,
      xGA: parseFloat(t.xGA) || 0,
      npxGA: parseFloat(t.npxGA) || 0,
      npxGD: parseFloat(t.npxGD) || 0,
      ppda: t.ppda || { att: 0, def: 0 },
      ppda_allowed: t.ppda_allowed || { att: 0, def: 0 },
      deep: parseInt(t.deep) || 0,
      deep_allowed: parseInt(t.deep_allowed) || 0,
      xpts: parseFloat(t.xpts) || 0,
      xpts_diff: parseFloat(t.xpts_diff) || 0,
      matches: t.history || [],
    })
  }
  return teams
}

/**
 * Get league player stats (xG, xA, xGChain, xGBuildup)
 */
export async function fetchLeaguePlayers(leagueCode: string, seasonYear?: number): Promise<UnderstatPlayer[]> {
  const slug = toUnderstatLeague(leagueCode)
  const year = seasonYear || 2024
  const url = `${BASE}/league/${slug}/${year}`
  const data = await fetchUnderstatJSON(url, `fetchLeaguePlayers(${slug}/${year})`)
  if (!data?.playersData) return []

  const players: UnderstatPlayer[] = []
  for (const [idStr, pd] of Object.entries(data.playersData)) {
    const p = pd as any
    players.push({
      id: parseInt(idStr),
      player_name: p.player_name,
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
  // Sort by xG descending
  players.sort((a, b) => b.xG - a.xG)
  return players
}

/**
 * Get match details with shot coordinates and xG
 */
export async function fetchMatch(matchId: number): Promise<UnderstatMatch | null> {
  const url = `${BASE}/match/${matchId}/`
  const data = await fetchUnderstatJSON(url, `fetchMatch(${matchId})`)
  if (!data?.matchesData?.[String(matchId)]) return null

  const m = data.matchesData[String(matchId)]
  return {
    id: m.id,
    date: m.date,
    home_team: m.h?.title || '',
    away_team: m.a?.title || '',
    home_goals: parseInt(m.h?.goals) || 0,
    away_goals: parseInt(m.a?.goals) || 0,
    home_xG: parseFloat(m.h?.xG) || 0,
    away_xG: parseFloat(m.a?.xG) || 0,
    forecast_w: parseFloat(m.h?.forecast_w) || 0,
    forecast_d: parseFloat(m.forecast_d) || 0,
    forecast_l: parseFloat(m.a?.forecast_w) || 0,
    url: `${BASE}/match/${matchId}/`,
    match_info: m,
    shots: {
      h: (m.h?.shots || []).map((s: any) => ({
        id: s.id || 0,
        minute: parseInt(s.minute) || 0,
        result: s.result || 'Unknown',
        X: parseFloat(s.X) || 0,
        Y: parseFloat(s.Y) || 0,
        xG: parseFloat(s.xG) || 0,
        player: s.player || '',
        homeTeam: m.h?.title || '',
        awayTeam: m.a?.title || '',
        situation: s.situation || '',
        shotType: s.shotType || '',
        player_assisted: s.player_assisted || null,
        lastAction: s.lastAction || '',
      })),
      a: (m.a?.shots || []).map((s: any) => ({
        id: s.id || 0,
        minute: parseInt(s.minute) || 0,
        result: s.result || 'Unknown',
        X: parseFloat(s.X) || 0,
        Y: parseFloat(s.Y) || 0,
        xG: parseFloat(s.xG) || 0,
        player: s.player || '',
        homeTeam: m.h?.title || '',
        awayTeam: m.a?.title || '',
        situation: s.situation || '',
        shotType: s.shotType || '',
        player_assisted: s.player_assisted || null,
        lastAction: s.lastAction || '',
      })),
    },
  }
}

/**
 * Get team match history with xG data for a season
 */
export async function fetchTeamMatches(teamId: number, seasonYear?: number): Promise<any[]> {
  const year = seasonYear || 2024
  const url = `${BASE}/team/${teamId}/${year}`
  const data = await fetchUnderstatJSON(url, `fetchTeamMatches(${teamId}/${year})`)
  if (!data?.datesData) return []

  const matches: any[] = []
  for (const dateStr of Object.keys(data.datesData).sort()) {
    const dateMatches = data.datesData[dateStr]
    if (Array.isArray(dateMatches)) {
      for (const m of dateMatches) {
        matches.push({
          ...m,
          date: dateStr,
          isHome: m.h?.id === teamId,
        })
      }
    }
  }
  return matches
}

/**
 * Get player detailed stats across matches
 */
export async function fetchPlayerStats(playerId: number): Promise<any | null> {
  const url = `${BASE}/player/${playerId}`
  const data = await fetchUnderstatJSON(url, `fetchPlayerStats(${playerId})`)
  if (!data?.playersData?.[String(playerId)]) return null
  return data.playersData[String(playerId)]
}

/**
 * Normalize an Understat shot to ELASTICO shot map format
 * Understat uses 0–1 coordinates where 0,0 = bottom-left of FULL pitch
 * We need to flip Y for away team and map to percentage
 */
export function normalizeUnderstatShot(
  shot: UnderstatShot,
  side: 'home' | 'away'
): {
  x: number
  y: number
  team: string
  goal: boolean
  xg: number
  player: string
  minute: number
  outcome: string
  situation: string
} {
  // Understat X: 0=own goal line, 1=opponent goal line
  // Understat Y: 0=bottom, 1=top
  // For home team shooting right: x stays, y stays
  // For away team shooting left: x = 1-x (mirror), y stays
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