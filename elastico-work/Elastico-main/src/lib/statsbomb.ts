/**
 * ELASTICO — StatsBomb Open Data Service
 *
 * Free, no-auth, no-key-required access to deep football analytics:
 * - Competitions & seasons
 * - Match lineups & events (100+ attributes per event)
 * - Shot coordinates with xG values
 * - Pass networks, pressure maps, 360 data
 *
 * Data served from GitHub raw URLs:
 *   https://raw.githubusercontent.com/statsbomb/open-data/master/data/
 *
 * Limitations:
 *   - Historical data only (not live/current-season real-time)
 *   - Data is released after tournaments conclude
 *   - Available competitions: World Cup, Euros, WWC, UCL, FA WSL,
 *     Bundesliga, La Liga, NWSL, etc.
 */

const BASE = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SBCompetition {
  competition_id: number
  season_id: number
  country_name: string
  competition_name: string
  competition_gender: string
  competition_youth: boolean
  competition_international: boolean
  season_name: string
  match_updated: string | null
  match_updated_360: string | null
  match_available_360: string | null
  match_available: string | null
}

export interface SBMatch {
  match_id: number
  match_date: string
  kick_off: string
  competition: { id: number; name: string; country_name: string; gender: string; competition_type: string; season_name: string }
  season: { id: number; name: string }
  home_team: { id: number; name: string; home_team_name: string; short_name: string | null; country: { id: number; name: string }; manager: string | null }
  away_team: { id: number; name: string; away_team_name: string; short_name: string | null; country: { id: number; name: string }; manager: string | null }
  home_score: number
  away_score: number
  match_status: string
  match_week: number
  competition_stage: { id: number; name: string }
  stadium: { id: number; name: string; country: string | null }
  referee: { id: number; name: string; country: { id: number; name: string } } | null
  metadata: {
    data_version: string
    shot_fidelity_version: string | null
    xy_fidelity_version: string | null
    start_time_tz: string | null
    game_package: boolean | null
  }
}

export interface SBEvent {
  id: number
  index: number
  period: number
  timestamp: string
  minute: number
  second: number
  type: { id: number; name: string }
  possession: number
  possession_team: { id: number; name: string }
  play_pattern: { id: number; name: string }
  team: { id: number; name: string }
  player: { id: number; name: string } | null
  position: { id: number; name: string } | null
  location: [number, number] | null
  duration: number | null
  // Shot-specific
  shot?: {
    end_location: [number, number] | null
    outcome: { id: number; name: string } | null
    type: { id: number; name: string } | null
    technique: { id: number; name: string } | null
    body_part: { id: number; name: string } | null
    statsbomb_xg: number
    freeze_frame: any[] | null
    one_on_one: boolean | null
    saved_to_post: boolean | null
    aerial_won: boolean | null
    deflected: boolean | null
    open_goal: boolean | null
    follows_dribble: boolean | null
    first_time: boolean | null
  }
  // Pass-specific
  pass?: {
    length: number | null
    angle: number | null
    height: { id: number; name: string } | null
    end_location: [number, number] | null
    recipient: { id: number; name: string } | null
    outcome: { id: number; name: string } | null
    type: { id: number; name: string } | null
    body_part: { id: number; name: string } | null
    technique: { id: number; name: string } | null
    cross: boolean | null
    shot_assist: boolean | null
    goal_assist: boolean | null
    switched: boolean | null
    straight: boolean | null
    cut_back: boolean | null
    outswinging: boolean | null
    inswinging: boolean | null
    high_pass: boolean | null
    low_pass: boolean | null
    left_foot: boolean | null
    right_foot: boolean | null
    head: boolean | null
  }
  // Carry-specific
  carry?: {
    end_location: [number, number] | null
    duration: number | null
    distance: number | null
  }
  // Pressure
  under_pressure: boolean | null
  counterpress: boolean | null
  // 360 data
  related_events: number[] | null
  related_events_360: number[] | null
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function sbFetch<T>(path: string, label: string): Promise<T | null> {
  try {
    const url = `${BASE}${path}`
    const res = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24h — historical data rarely changes
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) {
      console.warn(`[StatsBomb] ${label}: HTTP ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`[StatsBomb] ${label}:`, err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all available free competitions and seasons
 */
export async function fetchCompetitions(): Promise<SBCompetition[]> {
  const data = await sbFetch<SBCompetition[]>('/competitions.json', 'fetchCompetitions')
  return data || []
}

/**
 * Get all matches for a competition/season
 */
export async function fetchMatches(competitionId: number, seasonId: number): Promise<SBMatch[]> {
  const data = await sbFetch<SBMatch[]>(
    `/matches/${competitionId}/${seasonId}.json`,
    `fetchMatches(${competitionId}/${seasonId})`
  )
  return data || []
}

/**
 * Get all events for a specific match (full depth — 100+ attributes)
 */
export async function fetchEvents(matchId: number): Promise<SBEvent[]> {
  const data = await sbFetch<SBEvent[]>(
    `/events/${matchId}.json`,
    `fetchEvents(${matchId})`
  )
  return data || []
}

/**
 * Get 360 freeze-frame data for a match (if available)
 */
export async function fetch360Data(matchId: number): Promise<any[] | null> {
  const data = await sbFetch<any[]>(
    `/three-sixty/${matchId}.json`,
    `fetch360Data(${matchId})`
  )
  return data
}

/**
 * Get lineups for a match
 */
export async function fetchLineups(matchId: number): Promise<any[] | null> {
  const data = await sbFetch<any[]>(
    `/lineups/${matchId}.json`,
    `fetchLineups(${matchId})`
  )
  return data
}

// ── Processed data extractors ──────────────────────────────────────────────────

export interface ShotData {
  id: number
  minute: number
  player: string | null
  team: string
  x: number
  y: number
  endX: number | null
  endY: number | null
  xg: number
  outcome: string
  type: string | null
  technique: string | null
  bodyPart: string | null
  distance: number | null
  angle: number | null
}

/**
 * Extract only shot events with coordinates and xG from a match
 */
export function extractShots(events: SBEvent[]): ShotData[] {
  return events
    .filter(e => e.type?.name === 'Shot' && e.shot && e.location)
    .map(e => {
      const shot = e.shot!
      const endLoc = shot.end_location
      const dx = endLoc ? endLoc[0] - e.location![0] : null
      const dy = endLoc ? endLoc[1] - e.location![1] : null
      const distance = dx !== null && dy !== null ? Math.sqrt(dx * dx + dy * dy) : null
      const angle = endLoc && e.location
        ? Math.abs(Math.atan2(Math.abs(endLoc[1] - e.location[1]), endLoc[0] - e.location[0]) * (180 / Math.PI))
        : null
      return {
        id: e.id,
        minute: e.minute,
        player: e.player?.name || null,
        team: e.team.name,
        x: e.location![0],
        y: e.location![1],
        endX: endLoc ? endLoc[0] : null,
        endY: endLoc ? endLoc[1] : null,
        xg: shot.statsbomb_xg ?? 0,
        outcome: shot.outcome?.name || 'Unknown',
        type: shot.type?.name || null,
        technique: shot.technique?.name || null,
        bodyPart: shot.body_part?.name || null,
        distance,
        angle,
      }
    })
}

export interface PassData {
  id: number
  minute: number
  player: string | null
  team: string
  x: number
  y: number
  endX: number | null
  endY: number | null
  length: number | null
  angle: number | null
  height: string | null
  outcome: string | null  // null = completed
  type: string | null    // cross, free kick, corner, etc.
  goalAssist: boolean
  shotAssist: boolean
}

/**
 * Extract pass events (completed + incomplete) for heat maps
 */
export function extractPasses(events: SBEvent[], completedOnly = true): PassData[] {
  return events
    .filter(e => {
      if (e.type?.name !== 'Pass' || !e.pass || !e.location) return false
      if (completedOnly && e.pass.outcome) return false
      return true
    })
    .map(e => {
      const pass = e.pass!
      return {
        id: e.id,
        minute: e.minute,
        player: e.player?.name || null,
        team: e.team.name,
        x: e.location![0],
        y: e.location![1],
        endX: pass.end_location ? pass.end_location[0] : null,
        endY: pass.end_location ? pass.end_location[1] : null,
        length: pass.length,
        angle: pass.angle,
        height: pass.height?.name || null,
        outcome: pass.outcome?.name || null,
        type: pass.type?.name || null,
        goalAssist: pass.goal_assist ?? false,
        shotAssist: pass.shot_assist ?? false,
      }
    })
}

export interface TeamXG {
  team: string
  totalXg: number
  shots: number
  goals: number
  shotsOnTarget: number
  shotData: ShotData[]
}

/**
 * Aggregate xG by team from events
 */
export function aggregateTeamXG(events: SBEvent[], homeTeam: string, awayTeam: string): { home: TeamXG; away: TeamXG } {
  const shots = extractShots(events)
  const split = (team: string): TeamXG => {
    const teamShots = shots.filter(s => s.team === team)
    return {
      team,
      totalXg: teamShots.reduce((sum, s) => sum + s.xg, 0),
      shots: teamShots.length,
      goals: teamShots.filter(s => s.outcome === 'Goal').length,
      shotsOnTarget: teamShots.filter(s => ['Goal', 'Saved', 'Post', 'Saved to Post'].includes(s.outcome)).length,
      shotData: teamShots,
    }
  }
  return { home: split(homeTeam), away: split(awayTeam) }
}

/**
 * Convert StatsBomb pitch coordinates (0-120 x 0-80) to percentage (0-100)
 * for CSS positioning on the shot map
 */
export function sbToPercent(x: number, y: number): { px: number; py: number } {
  return {
    px: (x / 120) * 100,
    py: (y / 80) * 100,
  }
}

/**
 * Normalize a shot for the ELASTICO frontend shot map format
 */
export function normalizeShotForMap(shot: ShotData, side: 'home' | 'away'): {
  x: number
  y: number
  team: string
  goal: boolean
  xg: number
  player: string | null
  minute: number
  outcome: string
} {
  const { px, py } = sbToPercent(shot.x, shot.y)
  return {
    x: px,
    y: py,
    team: side,
    goal: shot.outcome === 'Goal',
    xg: shot.xg,
    player: shot.player,
    minute: shot.minute,
    outcome: shot.outcome,
  }
}