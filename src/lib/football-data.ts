/**
 * ELASTICO — ESPN Football Data Service
 *
 * Fetches live scores, fixtures, and results from ESPN's public API.
 * No API key required. Covers: PL, La Liga, Serie A, Bundesliga, Ligue 1, MLS,
 * Champions League, Europa League, Copa America, international fixtures.
 */

const ESPN_LEAGUES = [
  { espnId: 'eng.1', name: 'Premier League', code: 'PL' },
  { espnId: 'esp.1', name: 'La Liga', code: 'LIGA' },
  { espnId: 'ita.1', name: 'Serie A', code: 'SA' },
  { espnId: 'ger.1', name: 'Bundesliga', code: 'BL' },
  { espnId: 'fra.1', name: 'Ligue 1', code: 'L1' },
  { espnId: 'usa.1', name: 'MLS', code: 'MLS' },
  { espnId: 'uefa.champions', name: 'Champions League', code: 'UCL' },
  { espnId: 'uefa.europa', name: 'Europa League', code: 'UEL' },
  { espnId: 'fifa.world', name: 'World Cup', code: 'WC' },
  { espnId: 'copa.america', name: 'Copa America', code: 'CA' },
]

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
  status: string  // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_HALFTIME, STATUS_FULL_TIME, STATUS_POSTPONED
  date: string
  venue: string
  competition: string
  minute?: number
  homeRedCards?: number
  awayRedCards?: number
}

const STATUS_MAP: Record<string, string> = {
  'STATUS_SCHEDULED': 'upcoming',
  'STATUS_IN_PROGRESS': 'live',
  'STATUS_HALFTIME': 'halftime',
  'STATUS_FULL_TIME': 'finished',
  'STATUS_POSTPONED': 'postponed',
  'STATUS_CANCELLED': 'postponed',
  'STATUS_DELAYED': 'postponed',
}

export function mapStatus(espnStatus: string): string {
  return STATUS_MAP[espnStatus] || 'upcoming'
}

async function fetchESPN(league: string): Promise<ESPNMatch[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`
  try {
    const res = await fetch(url, {
      next: { revalidate: 120 }, // cache for 2 min
    })
    if (!res.ok) return []

    const data = await res.json()
    const events: ESPNMatch[] = []

    for (const event of data.events || []) {
      const comp = event.competitions?.[0]
      if (!comp) continue

      const competitors = comp.competitors || []
      if (competitors.length < 2) continue

      const home = competitors.find((c: { homeAway: string }) => c.homeAway === 'home') || competitors[0]
      const away = competitors.find((c: { homeAway: string }) => c.homeAway === 'away') || competitors[1]

      const statusDetail = comp.status?.type?.detail || ''
      const minuteMatch = statusDetail.match(/(\d+)\s*'/)
      const minute = minuteMatch ? parseInt(minuteMatch[1]) : undefined

      events.push({
        id: event.id?.toString() || comp.id?.toString() || '',
        homeTeam: {
          id: home.team?.id?.toString() || '',
          name: home.team?.displayName || home.team?.shortDisplayName || 'Unknown',
          abbreviation: home.team?.abbreviation || '???',
          logo: home.team?.logo || '',
          color: home.team?.color || '#00e676',
        },
        awayTeam: {
          id: away.team?.id?.toString() || '',
          name: away.team?.displayName || away.team?.shortDisplayName || 'Unknown',
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
        minute,
      })
    }

    return events
  } catch (err) {
    console.error(`[ESPN] Failed to fetch ${league}:`, err)
    return []
  }
}

/** Fetch live scores from all configured leagues */
export async function fetchAllLiveScores(): Promise<ESPNMatch[]> {
  const results = await Promise.allSettled(
    ESPN_LEAGUES.map(l => fetchESPN(l.espnId))
  )

  const allMatches: ESPNMatch[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMatches.push(...result.value)
    }
  }

  // Sort: live first, then upcoming by date, then finished
  const statusOrder: Record<string, number> = { live: 0, halftime: 1, upcoming: 2, finished: 3, postponed: 4 }
  allMatches.sort((a, b) => {
    const sa = statusOrder[mapStatus(a.status)] ?? 5
    const sb = statusOrder[mapStatus(b.status)] ?? 5
    if (sa !== sb) return sa - sb
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  })

  return allMatches
}

/** Fetch from a single league */
export async function fetchLeagueScores(leagueCode: string): Promise<ESPNMatch[]> {
  const league = ESPN_LEAGUES.find(l => l.code === leagueCode)
  if (!league) return []
  return fetchESPN(league.espnId)
}

export { ESPN_LEAGUES }