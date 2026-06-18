/**
 * ELASTICO — ESPN Football Data Service (Extended)
 *
 * Uses ESPN's public APIs (no key needed) for:
 * - Live scores & fixtures (site API)
 * - League standings (apis/v2, not site/v2 which returns empty for soccer)
 * - Team details & rosters
 * - Injuries
 * - Match summary with play-by-play
 * - Match odds & win probability (core API)
 * - League news
 *
 * Based on: https://github.com/pseudo-r/Public-ESPN-API
 */

// ── League Config ──────────────────────────────────────────────────────────────

export const ESPN_LEAGUES = [
  { espnId: 'eng.1', name: 'Premier League', code: 'PL' },
  { espnId: 'esp.1', name: 'La Liga', code: 'LIGA' },
  { espnId: 'ita.1', name: 'Serie A', code: 'SA' },
  { espnId: 'ger.1', name: 'Bundesliga', code: 'BL' },
  { espnId: 'fra.1', name: 'Ligue 1', code: 'L1' },
  { espnId: 'usa.1', name: 'MLS', code: 'MLS' },
  { espnId: 'uefa.champions', name: 'Champions League', code: 'UCL' },
  { espnId: 'uefa.europa', name: 'Europa League', code: 'UEL' },
  { espnId: 'fifa.world', name: 'World Cup', code: 'WC' },
  { espnId: 'conmebol.america', name: 'Copa America', code: 'CA' },
  { espnId: 'ned.1', name: 'Eredivisie', code: 'ERE' },
  { espnId: 'por.1', name: 'Primeira Liga', code: 'PPL' },
  { espnId: 'ger.2', name: '2. Bundesliga', code: 'BL2' },
  { espnId: 'eng.2', name: 'Championship', code: 'ECH' },
  { espnId: 'bra.1', name: 'Serie A Brazil', code: 'BRA' },
  { espnId: 'arg.1', name: 'Liga Profesional', code: 'ARG' },
  { espnId: 'mex.1', name: 'Liga MX', code: 'MX' },
  { espnId: 'caf.champions', name: 'CAF Champions League', code: 'CAFCL' },
  { espnId: 'afc.champions', name: 'AFC Champions League', code: 'AFCCL' },
  { espnId: 'uefa.euro', name: 'Euro Championship', code: 'EURO' },
]

const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer'
const SITE_WEB_V2 = 'https://site.web.api.espn.com/apis/v2/sports/soccer'
const CORE_V2 = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ESPNTeam {
  id: string
  name: string
  abbreviation: string
  logo: string
  color: string
}

export interface ESPNMatch {
  id: string
  homeTeam: ESPNTeam
  awayTeam: ESPNTeam
  homeScore: number
  awayScore: number
  status: string
  date: string
  venue: string
  competition: string
  minute?: number
}

export interface ESPNStandingTeam {
  rank: number
  team: string
  code: string
  logo: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  form: string  // e.g. "WWDLW"
  streak: string
  homeRecord: string
  awayRecord: string
}

export interface ESPNPlayer {
  id: string
  name: string
  firstName: string
  lastName: string
  position: string
  age: number
  nationality: string
  shirtNumber: number
  rating?: number
  goals?: number
  assists?: number
  appearances?: number
}

export interface ESPNInjury {
  player: string
  team: string
  status: string  // 'Out', 'Questionable', 'Doubtful', etc.
  date: string
  type: string    // 'Knee', 'Ankle', 'Hamstring', etc.
  comment: string
}

export interface ESPNNewsItem {
  headline: string
  description: string
  link: string
  imageUrl: string
  source: string
  publishedAt: string
  type: string
}

export interface ESPNMatchOdds {
  provider: string
  homeWin: number
  draw: number
  awayWin: number
  overUnder: number
  spread: number
}

export interface ESPNWinProbability {
  home: number
  away: number
  minute: number
}

export interface ESPNPlayByPlay {
  minute: number
  type: string  // 'goal', 'yellow_card', 'red_card', 'substitution', 'save', etc.
  text: string
  team: string
  playerName: string
  homeScore: number
  awayScore: number
}

// ── Status Mapping ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  'STATUS_SCHEDULED': 'upcoming',
  'STATUS_IN_PROGRESS': 'live',
  'STATUS_HALFTIME': 'halftime',
  'STATUS_FULL_TIME': 'finished',
  'STATUS_POSTPONED': 'postponed',
  'STATUS_CANCELLED': 'postponed',
  'STATUS_DELAYED': 'postponed',
  'STATUS_ABANDONED': 'postponed',
}

export function mapStatus(espnStatus: string): string {
  return STATUS_MAP[espnStatus] || 'upcoming'
}

// ── Core Fetch ─────────────────────────────────────────────────────────────────

async function espnFetch(url: string, revalidate = 120): Promise<any> {
  try {
    const res = await fetch(url, { next: { revalidate } })
    if (!res.ok) return null
    return res.json()
  } catch (err) {
    console.error(`[ESPN] Failed: ${url}`, err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCOREBOARD (Live Scores)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchScoreboard(league: string): Promise<ESPNMatch[]> {
  const url = `${SITE_V2}/${league}/scoreboard`
  const data = await espnFetch(url, 60)
  if (!data) return []

  const events: ESPNMatch[] = []
  for (const event of data.events || []) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const competitors = comp.competitors || []
    if (competitors.length < 2) continue

    const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0]
    const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1]
    const statusDetail = comp.status?.type?.detail || ''
    const minuteMatch = statusDetail.match(/(\d+)\s*'/)

    events.push({
      id: event.id?.toString() || '',
      homeTeam: {
        id: home.team?.id?.toString() || '',
        name: home.team?.displayName || 'Unknown',
        abbreviation: home.team?.abbreviation || '???',
        logo: home.team?.logo || '',
        color: home.team?.color || '#00e676',
      },
      awayTeam: {
        id: away.team?.id?.toString() || '',
        name: away.team?.displayName || 'Unknown',
        abbreviation: away.team?.abbreviation || '???',
        logo: away.team?.logo || '',
        color: away.team?.color || '#ffffff',
      },
      homeScore: parseInt(home.score) || 0,
      awayScore: parseInt(away.score) || 0,
      status: comp.status?.type?.name || 'STATUS_SCHEDULED',
      date: event.date || '',
      venue: comp.venue?.fullName || '',
      competition: event.name || league,
      minute: minuteMatch ? parseInt(minuteMatch[1]) : undefined,
    })
  }
  return events
}

export async function fetchAllLiveScores(): Promise<ESPNMatch[]> {
  const results = await Promise.allSettled(ESPN_LEAGUES.map(l => fetchScoreboard(l.espnId)))
  const allMatches: ESPNMatch[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') allMatches.push(...r.value)
  }
  const statusOrder: Record<string, number> = { live: 0, halftime: 1, upcoming: 2, finished: 3, postponed: 4 }
  allMatches.sort((a, b) => {
    const sa = statusOrder[mapStatus(a.status)] ?? 5
    const sb = statusOrder[mapStatus(b.status)] ?? 5
    if (sa !== sb) return sa - sb
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })
  return allMatches
}

export async function fetchLeagueScores(leagueCode: string): Promise<ESPNMatch[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []
  return fetchScoreboard(league.espnId)
}

export async function fetchDateScores(dateStr: string, leagueCode?: string): Promise<ESPNMatch[]> {
  const leagues = leagueCode
    ? [ESPN_LEAGUES.find(l => l.code === leagueCode)].filter(Boolean)
    : ESPN_LEAGUES
  const allMatches: ESPNMatch[] = []
  for (const l of leagues) {
    const url = `${SITE_V2}/${l!.espnId}/scoreboard?dates=${dateStr}`
    const data = await espnFetch(url, 60)
    if (!data) continue
    for (const event of data.events || []) {
      const comp = event.competitions?.[0]
      if (!comp) continue
      const competitors = comp.competitors || []
      if (competitors.length < 2) continue
      const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0]
      const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1]
      allMatches.push({
        id: event.id?.toString() || '',
        homeTeam: { id: home.team?.id || '', name: home.team?.displayName || '?', abbreviation: home.team?.abbreviation || '?', logo: home.team?.logo || '', color: home.team?.color || '#00e676' },
        awayTeam: { id: away.team?.id || '', name: away.team?.displayName || '?', abbreviation: away.team?.abbreviation || '?', logo: away.team?.logo || '', color: away.team?.color || '#fff' },
        homeScore: parseInt(home.score) || 0,
        awayScore: parseInt(away.score) || 0,
        status: comp.status?.type?.name || 'STATUS_SCHEDULED',
        date: event.date || '',
        venue: comp.venue?.fullName || '',
        competition: event.name || l!.name,
      })
    }
  }
  return allMatches
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDINGS (use /apis/v2/ not /apis/site/v2/ for soccer)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchStandings(leagueCode: string): Promise<ESPNStandingTeam[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  // Try /apis/v2/ first (works for soccer standings), fallback to /apis/site/v2/
  let data = await espnFetch(`${SITE_WEB_V2}/${league.espnId}/standings`, 300)
  if (!data || !data.children?.length) {
    data = await espnFetch(`${SITE_V2}/${league.espnId}/standings`, 300)
  }

  if (!data?.children) return []

  const standings: ESPNStandingTeam[] = []

  for (const group of data.children) {
    for (const entry of group.standings?.entries || []) {
      const team = entry.team
      const stats = entry.stats || []

      const getStat = (name: string) => {
        const s = stats.find((st: any) => st.name === name)
        return s ? parseFloat(s.displayValue) : 0
      }

      standings.push({
        rank: entry.rank || 0,
        team: team?.displayName || team?.shortDisplayName || 'Unknown',
        code: team?.abbreviation || '???',
        logo: team?.logo || '',
        played: getStat('gamesPlayed') || (getStat('wins') + getStat('losses') + getStat('ties')),
        wins: getStat('wins'),
        draws: getStat('ties'),
        losses: getStat('losses'),
        goalsFor: getStat('pointsFor'),
        goalsAgainst: getStat('pointsAgainst'),
        goalDiff: getStat('pointDifferential'),
        points: getStat('standingPoints') || getStat('points'),
        form: stats.find((s: any) => s.name === 'form')?.displayValue || '',
        streak: stats.find((s: any) => s.name === 'streak')?.displayValue || '',
        homeRecord: stats.find((s: any) => s.name === 'recordHome')?.displayValue || '',
        awayRecord: stats.find((s: any) => s.name === 'recordAway')?.displayValue || '',
      })
    }
  }

  return standings.sort((a, b) => a.rank - b.rank)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEAMS & ROSTERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchTeams(leagueCode: string) {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${SITE_V2}/${league.espnId}/teams`, 3600)
  if (!data?.teams) return []

  return data.teams.map((t: any) => ({
    id: t.team?.id?.toString() || '',
    name: t.team?.displayName || 'Unknown',
    abbreviation: t.team?.abbreviation || '???',
    logo: t.team?.logo || '',
    color: t.team?.color || '#fff',
    record: t.team?.recordSummary || '',
  }))
}

export async function fetchTeamRoster(leagueCode: string, teamId: string): Promise<ESPNPlayer[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${SITE_V2}/${league.espnId}/teams/${teamId}/roster`, 3600)
  if (!data?.athletes) return []

  return data.athletes.map((a: any) => ({
    id: a.athlete?.id?.toString() || '',
    name: a.athlete?.displayName || 'Unknown',
    firstName: a.athlete?.firstName || '',
    lastName: a.athlete?.lastName || '',
    position: a.athlete?.position?.displayName || '',
    age: a.athlete?.age || 0,
    nationality: a.athlete?.nationality || '',
    shirtNumber: a.athlete?.jersey || 0,
  }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// INJURIES
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchInjuries(leagueCode: string, teamId?: string): Promise<ESPNInjury[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const endpoint = teamId
    ? `${SITE_V2}/${league.espnId}/teams/${teamId}/injuries`
    : `${SITE_V2}/${league.espnId}/teams` // need to iterate teams

  const data = await espnFetch(endpoint, 600)
  if (!data) return []

  const injuries: ESPNInjury[] = []

  if (teamId && data.injuries) {
    // Single team injuries
    for (const inj of data.injuries) {
      injuries.push({
        player: inj.athlete?.displayName || 'Unknown',
        team: inj.team?.displayName || '',
        status: inj.status?.displayValue || '',
        date: inj.date || '',
        type: inj.injuryType || '',
        comment: inj.comment || '',
      })
    }
  } else if (data.teams) {
    // All teams — get injury count from each team
    for (const t of data.teams) {
      const tName = t.team?.displayName || ''
      for (const inj of (t.injuries || [])) {
        injuries.push({
          player: inj.athlete?.displayName || 'Unknown',
          team: tName,
          status: inj.status?.displayValue || '',
          date: inj.date || '',
          type: inj.injuryType || '',
          comment: inj.comment || '',
        })
      }
    }
  }

  return injuries
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH DETAILS (Summary, Odds, Win Probability, Play-by-Play)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchMatchSummary(leagueCode: string, eventId: string) {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return null
  return espnFetch(`${SITE_V2}/${league.espnId}/summary?event=${eventId}`, 60)
}

export async function fetchMatchOdds(leagueCode: string, eventId: string): Promise<ESPNMatchOdds[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${CORE_V2}/${league.espnId}/events/${eventId}/competitions/${eventId}/odds`, 120)
  if (!data?.items) return []

  return data.items.map((item: any) => ({
    provider: item.provider?.name || '',
    homeWin: parseFloat(item.homeTeamOdds?.value) || 0,
    draw: parseFloat(item.drawOdds?.value) || 0,
    awayWin: parseFloat(item.awayTeamOdds?.value) || 0,
    overUnder: parseFloat(item.overUnder?.value) || 0,
    spread: parseFloat(item.spread?.value) || 0,
  }))
}

export async function fetchWinProbability(leagueCode: string, eventId: string): Promise<ESPNWinProbability[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${CORE_V2}/${league.espnId}/events/${eventId}/competitions/${eventId}/probabilities`, 60)
  if (!data?.items) return []

  return data.items.map((item: any) => ({
    home: parseFloat(item.homePercentage) || 0,
    away: parseFloat(item.awayPercentage) || 0,
    minute: item.playByPlayNumber || 0,
  }))
}

export async function fetchPlayByPlay(leagueCode: string, eventId: string): Promise<ESPNPlayByPlay[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${CORE_V2}/${league.espnId}/events/${eventId}/competitions/${eventId}/plays?limit=300`, 60)
  if (!data?.items) return []

  return data.items.map((play: any) => {
    const period = play.period?.number || 0
    const clock = play.clock?.displayValue || ''
    const minute = period <= 1
      ? parseInt(clock) || 0
      : (period <= 2 ? 45 + (parseInt(clock) || 0) : 90 + (parseInt(clock) || 0))

    return {
      minute,
      type: play.type?.text || play.type?.description || 'unknown',
      text: play.text || '',
      team: play.competitor?.team?.abbreviation || '',
      playerName: play.athlete?.displayName || '',
      homeScore: play.competitor?.score !== undefined ? parseInt(play.competitor.score) || 0 : play.homeScore || 0,
      awayScore: play.awayScore || 0,
    }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAGUE NEWS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchLeagueNews(leagueCode: string): Promise<ESPNNewsItem[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${SITE_V2}/${league.espnId}/news`, 600)
  if (!data?.articles) return []

  return data.articles.map((a: any) => ({
    headline: a.headline || '',
    description: a.description || '',
    link: a.links?.web?.href || a.links?.mobile?.href || '',
    imageUrl: a.images?.[0]?.url || a.image?.url || '',
    source: a.source?.name || 'ESPN',
    publishedAt: a.published || a.date || '',
    type: a.type || 'article',
  }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAGUE LEADERS / TOP SCORERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchLeagueLeaders(leagueCode: string, category = 'goals') {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []

  const data = await espnFetch(`${CORE_V2}/${league.espnId}/leaders`, 3600)
  if (!data?.categories) return []

  const goalsCat = data.categories.find((c: any) =>
    c.name?.toLowerCase().includes('goals') || c.name?.toLowerCase().includes('scoring')
  )

  if (!goalsCat?.leaders) return []

  return goalsCat.leaders.map((l: any) => ({
    rank: l.rank || 0,
    name: l.athlete?.displayName || 'Unknown',
    team: l.team?.displayName || '',
    teamLogo: l.team?.logo || '',
    value: l.value || 0,
    category: goalsCat.name || 'Goals',
  }))
}