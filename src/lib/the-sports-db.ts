/**
 * ELASTICO — TheSportsDB Service
 *
 * Free tier (patron key "123"): covers leagues, teams, players, events,
 * badges/crests, and more.
 *
 * TheSportsDB injects the API key into the URL path:
 *   https://www.thesportsdb.com/api/v1/json/{key}/...
 *
 * Rate limit: Free tier is generous for non-commercial use.
 * Docs: https://www.thesportsdb.com/api.php
 */

const BASE = 'https://www.thesportsdb.com/api/v1/json'

function getKey(): string {
  return process.env.THE_SPORTS_DB_KEY || '123'
}

function url(path: string): string {
  return `${BASE}/${getKey()}${path}`
}

// ── League IDs (TheSportsDB) ──────────────────────────────────────────────────

export const TSD_LEAGUES = [
  { id: 4328, code: 'PL',  name: 'English Premier League' },
  { id: 4335, code: 'LIGA', name: 'Spanish La Liga' },
  { id: 4332, code: 'SA',  name: 'Italian Serie A' },
  { id: 4331, code: 'BL',  name: 'German Bundesliga' },
  { id: 4334, code: 'L1',  name: 'French Ligue 1' },
  { id: 4346, code: 'UCL', name: 'UEFA Champions League' },
  { id: 4481, code: 'UEL', name: 'UEFA Europa League' },
  { id: 4337, code: 'ERE', name: 'Dutch Eredivisie' },
  { id: 4344, code: 'PPL', name: 'Portuguese Primeira Liga' },
  { id: 4359, code: 'MLS', name: 'American Major League Soccer' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TSDLeague {
  idLeague: string
  strLeague: string
  strLeagueAlternate: string | null
  strSport: string
  strDivision: string | null
  idCup: string | null
  strCurrentSeason: string
  intFormedYear: string | null
  dateFirstEvent: string | null
  strGender: string
  strCountry: string
  strWebsite: string | null
  strFacebook: string | null
  strTwitter: string | null
  strYoutube: string | null
  strRSS: string | null
  strDescriptionEN: string | null
  strBadge: string | null
  strFanart1: string | null
  strFanart2: string | null
  strFanart3: string | null
  strFanart4: string | null
  strBanner: string | null
  strComplete: string | null
  strLocked: string | null
}

export interface TSDTeam {
  idTeam: string
  idSoccerXML: string | null
  idAPIfootball: string | null
  intLoved: string | null
  strTeam: string
  strTeamShort: string | null
  strAlternate: string | null
  intFormedYear: string | null
  strSport: string
  strLeague: string
  idLeague: string
  strStadium: string
  strStadiumThumb: string | null
  strStadiumDescription: string | null
  intStadiumCapacity: string | null
  strStadiumLocation: string | null
  strKeywords: string | null
  strRSS: string | null
  strDescriptionEN: string | null
  strColor: string | null
  strBadge: string | null
  strBadgeLg: string | null
  strFanart1: string | null
  strFanart2: string | null
  strFanart3: string | null
  strFanart4: string | null
  strBanner: string | null
  strLogo: string | null
  strKit: string | null
  strEquipment: string | null
  strFacebook: string | null
  strInstagram: string | null
  strTwitter: string | null
  strWebsite: string | null
  strYoutube: string | null
  strWikipedia: string | null
  strGender: string
  strCountry: string
  strTeamBanner: string | null
  enBadge: string | null
  // Normalized fields we'll add
  _leagueCode?: string
}

export interface TSDPlayer {
  idPlayer: string
  idSoccerXML: string | null
  idPlayerManager: string | null
  strNationality: string
  strPlayer: string
  strTeam: string
  strTeamShort: string | null
  intLoved: string | null
  dateBorn: string | null
  dateSigned: string | null
  strSigning: string | null
  strWage: string | null
  strBirthLocation: string | null
  strDescriptionEN: string | null
  strGender: string
  strPosition: string
  strHeight: string | null
  strWeight: string | null
  intSoccerRating: string | null
  strThumb: string | null
  strCutout: string | null
  strBanner: string | null
  strFanart1: string | null
  strFanart2: string | null
  strFacebook: string | null
  strInstagram: string | null
  strTwitter: string | null
  strWebsite: string | null
  strYoutube: string | null
  strWikipedia: string | null
  strRender: string | null
  strSport: string
  strTeamBadge: string | null
  strLocked: string | null
  _teamId?: string
}

export interface TSDEvent {
  idEvent: string
  idSoccerXML: string | null
  idAPIfootball: string | null
  strEvent: string
  strEventAlternate: string | null
  strFilename: string | null
  strSport: string
  idLeague: string
  strLeague: string
  strSeason: string
  strDescriptionEN: string | null
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intRound: string | null
  intAwayScore: string | null
  intSpectators: string | null
  strOfficial: string | null
  strTimestamp: string | null
  dateEvent: string
  dateEventLocal: string | null
  strTime: string | null
  strTimeLocal: string | null
  strTVStation: string | null
  idHomeTeam: string
  idAwayTeam: string
  strResult: string | null
  intHomeShots: string | null
  intAwayShots: string | null
  strHomeGoalDetails: string | null
  strAwayGoalDetails: string | null
  strHomeRedCards: string | null
  strAwayRedCards: string | null
  strHomeYellowCards: string | null
  strAwayYellowCards: string | null
  strHomeLineupGoalkeeper: string | null
  strHomeLineupDefense: string | null
  strHomeLineupMidfield: string | null
  strHomeLineupForward: string | null
  strHomeLineupSubstitutes: string | null
  strHomeFormation: string | null
  strAwayLineupGoalkeeper: string | null
  strAwayLineupDefense: string | null
  strAwayLineupMidfield: string | null
  strAwayLineupForward: string | null
  strAwayLineupSubstitutes: string | null
  strAwayFormation: string | null
  strHomeTeamBadge: string | null
  strAwayTeamBadge: string | null
  strVenue: string | null
  strCountry: string | null
  strPostponed: string | null
  strLocked: string | null
  // Normalized
  _leagueCode?: string
  _status?: string
}

export interface TSDTableEntry {
  idTeam: string
  strTeam: string
  strTeamBadge: string | null
  intPlayed: number
  intWin: number
  intDraw: number
  intLoss: number
  intGoalsFor: number
  intGoalsAgainst: number
  intGoalDifference: number
  intPoints: number
  strForm: string | null
  _leagueCode?: string
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function tsdFetch<T>(path: string, label: string): Promise<T | null> {
  try {
    const res = await fetch(url(path), { next: { revalidate: 300 } })
    if (!res.ok) {
      console.warn(`[TheSportsDB] ${label}: HTTP ${res.status}`)
      return null
    }
    const json = await res.json()
    return json as T
  } catch (err) {
    console.error(`[TheSportsDB] ${label}:`, err)
    return null
  }
}

// ── League lookups ────────────────────────────────────────────────────────────

function findLeagueByCode(code: string) {
  return TSD_LEAGUES.find(l => l.code.toUpperCase() === code.toUpperCase())
}

function findLeagueById(id: string | number) {
  return TSD_LEAGUES.find(l => l.id === Number(id))
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Search leagues by name
 */
export async function searchLeagues(query: string): Promise<TSDLeague[]> {
  const data = await tsdFetch<any>(`/search_all_leagues.php?c=${encodeURIComponent(query)}&s=Soccer`, 'searchLeagues')
  if (!data?.countrys) return []
  return data.countrys as TSDLeague[]
}

/**
 * Get all teams in a league
 */
export async function fetchTeamsByLeague(leagueId: string): Promise<TSDTeam[]> {
  const data = await tsdFetch<any>(`/lookup_all_teams.php?id=${leagueId}`, 'fetchTeamsByLeague')
  if (!data?.teams) return []
  return data.teams as TSDTeam[]
}

/**
 * Get teams in a league by our code (PL, LIGA, etc.)
 */
export async function fetchTeams(leagueCode: string): Promise<TSDTeam[]> {
  const league = findLeagueByCode(leagueCode)
  if (!league) return []
  const teams = await fetchTeamsByLeague(String(league.id))
  return teams.map(t => ({ ...t, _leagueCode: leagueCode }))
}

/**
 * Get team details by TheSportsDB team ID
 */
export async function fetchTeamDetails(teamId: string): Promise<TSDTeam | null> {
  const data = await tsdFetch<any>(`/lookupteam.php?id=${teamId}`, 'fetchTeamDetails')
  if (!data?.teams?.[0]) return null
  return data.teams[0] as TSDTeam
}

/**
 * Search teams by name
 */
export async function searchTeam(name: string): Promise<TSDTeam[]> {
  const data = await tsdFetch<any>(`/searchteams.php?t=${encodeURIComponent(name)}`, 'searchTeam')
  if (!data?.teams) return []
  return data.teams as TSDTeam[]
}

/**
 * Get players for a team
 */
export async function fetchPlayersByTeam(teamId: string): Promise<TSDPlayer[]> {
  const data = await tsdFetch<any>(`/lookup_all_players.php?id=${teamId}`, 'fetchPlayersByTeam')
  if (!data?.player) return []
  return data.player as TSDPlayer[]
}

/**
 * Search a player by name
 */
export async function searchPlayer(name: string): Promise<TSDPlayer[]> {
  const data = await tsdFetch<any>(`/searchplayers.php?p=${encodeURIComponent(name)}`, 'searchPlayer')
  if (!data?.player) return []
  return data.player as TSDPlayer[]
}

/**
 * Get player details by ID
 */
export async function fetchPlayerDetails(playerId: string): Promise<TSDPlayer | null> {
  const data = await tsdFetch<any>(`/lookupplayer.php?id=${playerId}`, 'fetchPlayerDetails')
  if (!data?.players?.[0]) return null
  return data.players[0] as TSDPlayer
}

/**
 * Get last 5 events for a team (recent results)
 */
export async function fetchLastEvents(teamId: string): Promise<TSDEvent[]> {
  const data = await tsdFetch<any>(`/eventslast.php?id=${teamId}`, 'fetchLastEvents')
  if (!data?.results) return []
  return data.results as TSDEvent[]
}

/**
 * Get next 5 events for a team (upcoming fixtures)
 */
export async function fetchNextEvents(teamId: string): Promise<TSDEvent[]> {
  const data = await tsdFetch<any>(`/eventsnext.php?id=${teamId}`, 'fetchNextEvents')
  if (!data?.events) return []
  return data.events as TSDEvent[]
}

/**
 * Get league table / standings for a league
 * Uses the lookuptable endpoint with league ID and season
 */
export async function fetchLeagueTable(leagueId: string, season?: string): Promise<TSDTableEntry[]> {
  const s = season || new Date().getFullYear().toString()
  const data = await tsdFetch<any>(`/lookuptable.php?l=${leagueId}&s=${s}`, 'fetchLeagueTable')
  if (!data?.table) return []
  return data.table.map((row: any) => ({
    idTeam: row.idTeam,
    strTeam: row.strTeam,
    strTeamBadge: row.strTeamBadge,
    intPlayed: parseInt(row.intPlayed) || 0,
    intWin: parseInt(row.intWin) || 0,
    intDraw: parseInt(row.intDraw) || 0,
    intLoss: parseInt(row.intLoss) || 0,
    intGoalsFor: parseInt(row.intGoalsFor) || 0,
    intGoalsAgainst: parseInt(row.intGoalsAgainst) || 0,
    intGoalDifference: parseInt(row.intGoalDifference) || 0,
    intPoints: parseInt(row.intPoints) || 0,
    strForm: row.strForm || null,
  }))
}

/**
 * Get league table by our code
 */
export async function fetchStandings(leagueCode: string, season?: string): Promise<TSDTableEntry[]> {
  const league = findLeagueByCode(leagueCode)
  if (!league) return []
  const table = await fetchLeagueTable(String(league.id), season)
  return table.map(r => ({ ...r, _leagueCode: leagueCode }))
}

/**
 * Get past events for a league (by round)
 */
export async function fetchLeagueEvents(leagueId: string, season?: string, round?: string): Promise<TSDEvent[]> {
  const s = season || new Date().getFullYear().toString()
  let path = `/eventsround.php?id=${leagueId}&r=${round || '38'}&s=${s}`
  const data = await tsdFetch<any>(path, 'fetchLeagueEvents')
  if (!data?.events) return []
  return data.events as TSDEvent[]
}

/**
 * Get all available leagues for a country
 */
export async function fetchLeaguesByCountry(country: string): Promise<TSDLeague[]> {
  const data = await tsdFetch<any>(`/search_all_leagues.php?c=${encodeURIComponent(country)}&s=Soccer`, 'fetchLeaguesByCountry')
  if (!data?.countrys) return []
  return data.countrys as TSDLeague[]
}

// ── Normalizers ───────────────────────────────────────────────────────────────

/**
 * Normalize a TSD event into the ELASTICO match format
 */
export function normalizeTSDEvent(event: TSDEvent): {
  id: string
  homeTeam: { name: string; code: string; logo: string; primaryColor: string }
  awayTeam: { name: string; code: string; logo: string; primaryColor: string }
  homeScore: number
  awayScore: number
  status: string
  date: string
  minute?: number
  venue?: string
  league: string
  source: string
} {
  const homeCode = (event.strHomeTeam || '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
  const awayCode = (event.strAwayTeam || '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()

  let status = 'finished'
  if (event.intHomeScore === null && event.intAwayScore === null) {
    status = 'upcoming'
  } else if (event.strPostponed === 'yes') {
    status = 'postponed'
  }

  return {
    id: event.idEvent,
    homeTeam: {
      name: event.strHomeTeam || 'TBD',
      code: homeCode || '???',
      logo: event.strHomeTeamBadge || '',
      primaryColor: '',
    },
    awayTeam: {
      name: event.strAwayTeam || 'TBD',
      code: awayCode || '???',
      logo: event.strAwayTeamBadge || '',
      primaryColor: '',
    },
    homeScore: parseInt(event.intHomeScore || '0'),
    awayScore: parseInt(event.intAwayScore || '0'),
    status,
    date: event.dateEvent || '',
    venue: event.strVenue || undefined,
    league: event.strLeague || '',
    source: 'TheSportsDB',
  }
}

/**
 * Normalize a TSD table entry into ELASTICO standings format
 */
export function normalizeTSDTableEntry(entry: TSDTableEntry): {
  position: number
  team: { name: string; shortName: string; tla: string; crest: string }
  playedGames: number
  form: string | null
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  source: string
} {
  return {
    position: 0, // caller should assign based on array index
    team: {
      name: entry.strTeam,
      shortName: entry.strTeam.slice(0, 3).toUpperCase(),
      tla: entry.strTeam.slice(0, 3).toUpperCase(),
      crest: entry.strTeamBadge || '',
    },
    playedGames: entry.intPlayed,
    form: entry.strForm,
    won: entry.intWin,
    draw: entry.intDraw,
    lost: entry.intLoss,
    points: entry.intPoints,
    goalsFor: entry.intGoalsFor,
    goalsAgainst: entry.intGoalsAgainst,
    goalDifference: entry.intGoalDifference,
    source: 'TheSportsDB',
  }
}