import { db } from '@/lib/db'
import type { Team, NewsArticle, Prediction, TeamAnalytic } from '@prisma/client'
import { AS_LEAGUES, fetchStandings as fetchASStandings, fetchFixtures, fetchHeadToHead, fetchLeagueOdds, fetchLeagueTeams, type ASStandingTeam, type ASFixture, type ASHeadToHead } from '@/lib/api-sports'
import { fetchStandings as fetchESPNStandings, fetchLeagueNews, fetchAllLiveScores, mapStatus, ESPN_LEAGUES } from '@/lib/football-data'

// Match with relations included — used internally for evidence building
type MatchWithTeams = Awaited<ReturnType<typeof db.match.findFirst>> & {
  homeTeam?: Team | null
  awayTeam?: Team | null
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface EvidenceSection {
  label: string
  truthClass: 'REAL' | 'DERIVED' | 'MISSING'
  content: string
}

export interface EvidencePackage {
  sections: EvidenceSection[]
  formatted: string       // ready to inject into the system/context message
  charCount: number
}

const MAX_EVIDENCE_CHARS = 6000 // keep the evidence package bounded and cheap

// ── Expanded multi-word team name patterns ────────────────────────────────
// Covers major European + global clubs that users commonly ask about
const MULTI_WORD_TEAMS = [
  // English
  'Manchester United', 'Manchester City', 'Tottenham Hotspur', 'Nottingham Forest',
  'Brighton and Hove Albion', 'West Ham United', 'Aston Villa', 'Newcastle United',
  'Wolverhampton Wanderers', 'Leicester City', 'Crystal Palace', 'Everton',
  'Liverpool', 'Chelsea', 'Arsenal',
  // Spanish
  'Real Madrid', 'Atletico Madrid', 'Athletic Bilbao', 'Real Sociedad',
  'Real Betis', 'Sevilla FC', 'Valencia CF', 'Villarreal CF', 'Celta Vigo',
  'Girona FC', 'Deportivo Alaves',
  // Italian
  'AC Milan', 'Inter Milan', 'Juventus', 'Napoli', 'AS Roma', 'SS Lazio',
  'Atalanta BC', 'ACF Fiorentina', 'Bologna FC', 'Torino FC',
  // German
  'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig',
  'VfB Stuttgart', 'Eintracht Frankfurt', 'SC Freiburg', 'TSG Hoffenheim',
  // French
  'Paris Saint-Germain', 'Paris Saint Germain', 'Olympique Marseille',
  'Olympique Lyon', 'AS Monaco', 'OGC Nice', 'Stade Brestois',
  // Others
  'FC Porto', 'SL Benfica', 'Sporting CP', 'Ajax Amsterdam', 'PSV Eindhoven',
  'Celtic FC', 'Rangers FC', 'Feyenoord Rotterdam',
]

// ── Team lookup helpers ───────────────────────────────────────────────────

/**
 * Attempts to find a real Team row matching a name fragment.
 * Plain SQL `contains` match — not fuzzy matching, not an embedding lookup.
 */
async function findTeamByName(nameFragment: string) {
  if (!nameFragment || nameFragment.length < 3) return null
  return db.team.findFirst({
    where: { name: { contains: nameFragment, mode: 'insensitive' } },
  })
}

/**
 * Extract team names from user message using multi-word patterns + single-word DB lookup.
 * Returns array of found teams (up to 2 for a match context).
 */
async function extractTeamsFromMessage(message: string): Promise<Team[]> {
  const found: Team[] = []
  const msgLower = message.toLowerCase()

  // 1. Try multi-word patterns first (most reliable)
  for (const pattern of MULTI_WORD_TEAMS) {
    if (msgLower.includes(pattern.toLowerCase())) {
      const team = await findTeamByName(pattern.split(' ').pop() || pattern)
      if (team && !found.find(t => t.id === team.id)) {
        found.push(team)
        if (found.length >= 2) break
      }
    }
  }

  if (found.length >= 2) return found

  // 2. Try single words > 3 chars against DB
  const words = message.split(/\s+/).filter(w => w.length > 3)
  for (const word of words) {
    const team = await findTeamByName(word)
    if (team && !found.find(t => t.id === team.id)) {
      found.push(team)
      if (found.length >= 2) break
    }
  }

  return found
}

// ── Dynamic season helper ─────────────────────────────────────────────────

function getSeason(): number {
  const now = new Date()
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
}

function getSeasonStr(): string {
  return String(getSeason())
}

// ── Evidence sections ──────────────────────────────────────────────────────

async function buildTeamFormSection(team: Team | null, teamName: string): Promise<EvidenceSection> {
  if (team) {
    const played = team.wins + team.draws + team.losses
    if (played > 0) {
      const goalDiff = team.goalsFor - team.goalsAgainst
      const gdStr = goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`
      return {
        label: 'TEAM FORM',
        truthClass: 'REAL',
        content: `${team.name}: ELO ${team.eloRating.toFixed(0)} · Record ${team.wins}W-${team.draws}D-${team.losses}L (${played} played) · Goals ${team.goalsFor}F/${team.goalsAgainst}A (GD ${gdStr}) · League: ${team.league ?? 'unknown'} (source: ${team.source}, synced ${team.lastSyncedAt.toISOString().slice(0, 10)})`,
      }
    }
    return {
      label: 'TEAM FORM',
      truthClass: 'REAL',
      content: `${team.name}: ELO ${team.eloRating.toFixed(0)} (default/no match history recorded). Source: ${team.source}, synced ${team.lastSyncedAt.toISOString().slice(0, 10)}.`,
    }
  }

  // LIVE FALLBACK: fetch from API-Sports standings
  try {
    const standing = await findLiveStanding(teamName)
    if (standing) {
      return {
        label: 'TEAM FORM [LIVE]',
        truthClass: 'REAL',
        content: `${standing.team.name}: Rank ${standing.rank} · ${standing.all.played}P ${standing.all.win}W-${standing.all.draw}D-${standing.all.lose}L · ${standing.points}pts · GD ${standing.goalsDiff >= 0 ? '+' : ''}${standing.goalsDiff} (source: api-sports live)`,
      }
    }
  } catch { /* silent */ }

  return { label: 'TEAM FORM', truthClass: 'MISSING', content: `No form data found for "${teamName}".` }
}

async function buildTeamAnalyticsSection(team: Team): Promise<EvidenceSection> {
  const analytics = await db.teamAnalytic.findMany({
    where: { teamId: team.id },
    orderBy: { syncedAt: 'desc' },
    take: 1,
  })

  if (analytics.length === 0) {
    return { label: 'TEAM ANALYTICS (xG)', truthClass: 'MISSING', content: `No advanced analytics data found for ${team.name}.` }
  }

  const a = analytics[0]
  const parts: string[] = []
  if (a.xgPerGame != null) parts.push(`xG: ${a.xgPerGame.toFixed(2)}/game`)
  if (a.xgaPerGame != null) parts.push(`xGA: ${a.xgaPerGame.toFixed(2)}/game`)
  if (a.npxGPerGame != null) parts.push(`nPxG: ${a.npxGPerGame.toFixed(2)}/game`)
  if (a.ppda != null) parts.push(`PPDA: ${a.ppda.toFixed(1)}`)
  if (a.deep != null) parts.push(`Deep completions: ${a.deep.toFixed(1)}/game`)

  if (parts.length === 0) {
    return { label: 'TEAM ANALYTICS (xG)', truthClass: 'MISSING', content: `Analytics row exists for ${team.name} (${a.source}, season ${a.season}) but all metric fields are null.` }
  }

  return {
    label: 'TEAM ANALYTICS (xG)',
    truthClass: a.truthClass === 'REAL' ? 'REAL' : 'DERIVED',
    content: `${team.name} (${a.source}, season ${a.season}, truth: ${a.truthClass}, freshness: ${a.dataFreshness ?? 'unknown'}): ${parts.join(' · ')}`,
  }
}

async function buildNewsSection(teamName: string): Promise<EvidenceSection> {
  // Try DB first
  const articles = await db.newsArticle.findMany({
    where: {
      OR: [
        { title: { contains: teamName, mode: 'insensitive' } },
        { summary: { contains: teamName, mode: 'insensitive' } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })

  if (articles.length > 0) {
    const lines = articles.map(a => {
      const age = a.publishedAt ? `${Math.round((Date.now() - a.publishedAt.getTime()) / 3_600_000)}h ago` : 'undated'
      const summary = (a.summary || a.title).slice(0, 180)
      return `- [${age}, ${a.sourceName}] ${summary}`
    })
    return { label: 'RECENT NEWS', truthClass: 'REAL', content: lines.join('\n') }
  }

  // LIVE FALLBACK: try ESPN news for relevant leagues
  try {
    const leagueCodes = ['PL', 'LIGA', 'SA', 'BL', 'L1', 'UCL']
    for (const code of leagueCodes) {
      const news = await fetchLeagueNews(code)
      if (news.length === 0) continue
      const teamNews = news
        .filter(n => {
          const text = `${n.headline || ''} ${n.description || ''}`.toLowerCase()
          return text.includes(teamName.toLowerCase())
        })
        .slice(0, 3)

      if (teamNews.length > 0) {
        const lines = teamNews.map(n => {
          const headline = (n.headline || '').slice(0, 180)
          return `- [ESPN, ${code}] ${headline}`
        })
        return { label: 'RECENT NEWS [LIVE]', truthClass: 'REAL' as const, content: lines.join('\n') }
      }
    }
  } catch { /* silent */ }

  return { label: 'RECENT NEWS', truthClass: 'MISSING', content: `No recent news found mentioning "${teamName}".` }
}

async function buildMatchSection(matchId: string): Promise<{ section: EvidenceSection; match: MatchWithTeams | null }> {
  const match = await db.match.findFirst({
    where: { OR: [{ id: matchId }, { sourceId: matchId }] },
    include: { homeTeam: true, awayTeam: true },
  })

  if (match) {
    const isNotStarted = match.status === 'upcoming' || match.status === 'scheduled'
    const scoreStr = isNotStarted ? 'not started' : `${match.homeScore}-${match.awayScore}`

    const xgParts: string[] = []
    if (match.homeXg != null) xgParts.push(`Home xG: ${match.homeXg.toFixed(2)}`)
    if (match.awayXg != null) xgParts.push(`Away xG: ${match.awayXg.toFixed(2)}`)
    if (match.homeXgSource) xgParts.push(`(xG source: ${match.homeXgSource}, class: ${match.homeXgTruthClass ?? 'unknown'})`)

    const extraStats: string[] = []
    if (match.possessionHome != null) extraStats.push(`Possession: ${match.possessionHome.toFixed(0)}%-${(100 - match.possessionHome).toFixed(0)}%`)
    if (match.shotsHome != null) extraStats.push(`Shots: ${match.shotsHome}-${match.shotsOnTargetHome ?? '?'}`)
    if (match.shotsOnTargetHome != null) extraStats.push(`SoT: ${match.shotsOnTargetHome}-${match.shotsOnTargetAway ?? '?'}`)

    const contentParts = [
      `${match.homeTeam?.name ?? 'Home'} vs ${match.awayTeam?.name ?? 'Away'}`,
      `${match.competition || 'Unknown competition'}${match.season ? ` ${match.season}` : ''}`,
      `Status: ${match.status}`,
      `Score: ${scoreStr}`,
      `Date: ${match.date?.toISOString() ?? 'unknown'}`,
    ]
    if (xgParts.length > 0) contentParts.push(xgParts.join(', '))
    if (extraStats.length > 0) contentParts.push(extraStats.join(' | '))

    return {
      section: { label: 'MATCH', truthClass: 'REAL', content: contentParts.join(' · ') },
      match,
    }
  }

  // LIVE FALLBACK: try to find the match via ESPN live scores
  try {
    const espnMatches = await fetchAllLiveScores()
    const espnMatch = espnMatches.find(m => m.id === matchId || m.homeTeam.id === matchId || m.awayTeam.id === matchId)
    if (espnMatch) {
      return {
        section: {
          label: 'MATCH [LIVE]',
          truthClass: 'REAL',
          content: `${espnMatch.homeTeam.name} vs ${espnMatch.awayTeam.name} · ${espnMatch.competition} · Status: ${mapStatus(espnMatch.status)} · Score: ${espnMatch.homeScore}-${espnMatch.awayScore} · Date: ${espnMatch.date} (source: ESPN live)`,
        },
        match: null,
      }
    }
  } catch { /* silent */ }

  return { section: { label: 'MATCH', truthClass: 'MISSING', content: `No match record found for id "${matchId}".` }, match: null }
}

async function buildExistingPredictionSection(matchId: string): Promise<EvidenceSection> {
  const match = await db.match.findFirst({
    where: { OR: [{ id: matchId }, { sourceId: matchId }] },
    select: { sourceId: true },
  })
  const searchId = match?.sourceId || matchId

  const prediction = await db.prediction.findFirst({
    where: { matchId: searchId },
    orderBy: { createdAt: 'desc' },
  })

  if (!prediction) {
    return { label: 'EXISTING PREDICTION', truthClass: 'MISSING', content: 'No prediction has been computed for this match yet.' }
  }

  return {
    label: 'EXISTING PREDICTION',
    truthClass: 'DERIVED',
    content: `${prediction.homeTeam} ${prediction.predictedHomeGoals}-${prediction.predictedAwayGoals} ${prediction.awayTeam} · Outcome: ${prediction.predictedOutcome} · Confidence: ${(prediction.confidence * 100).toFixed(0)}% · Model: ${prediction.model} · Created: ${prediction.createdAt.toISOString().slice(0, 10)}${prediction.isCorrect != null ? ` · Actual result: ${prediction.actualHomeGoals ?? '?'}-${prediction.actualAwayGoals ?? '?'} (${prediction.isCorrect ? 'CORRECT' : 'INCORRECT'})` : ''}`,
  }
}

async function buildOddsSection(homeTeamName: string, awayTeamName: string): Promise<EvidenceSection> {
  // Try DB first
  const odds = await db.oddsSnapshot.findFirst({
    where: {
      homeTeam: { contains: homeTeamName, mode: 'insensitive' },
      awayTeam: { contains: awayTeamName, mode: 'insensitive' },
    },
    orderBy: { fetchedAt: 'desc' },
  })

  if (odds) {
    const parts: string[] = []
    if (odds.homeWinOdds) parts.push(`Home: ${odds.homeWinOdds.toFixed(2)}`)
    if (odds.drawOdds) parts.push(`Draw: ${odds.drawOdds.toFixed(2)}`)
    if (odds.awayWinOdds) parts.push(`Away: ${odds.awayWinOdds.toFixed(2)}`)
    if (odds.bookmaker) parts.push(`Bookmaker: ${odds.bookmaker}`)
    parts.push(`Fetched: ${odds.fetchedAt.toISOString().slice(0, 16)}`)

    const impliedHome = odds.homeWinOdds ? ((1 / odds.homeWinOdds) * 100).toFixed(0) : '?'
    const impliedDraw = odds.drawOdds ? ((1 / odds.drawOdds) * 100).toFixed(0) : '?'
    const impliedAway = odds.awayWinOdds ? ((1 / odds.awayWinOdds) * 100).toFixed(0) : '?'

    return {
      label: 'BETTING ODDS',
      truthClass: 'REAL',
      content: `${parts.join(' · ')} · Implied probabilities: Home ${impliedHome}% / Draw ${impliedDraw}% / Away ${impliedAway}%`,
    }
  }

  // LIVE FALLBACK: try API-Sports odds for current fixtures
  try {
    for (const league of AS_LEAGUES.slice(0, 5)) {
      const oddsList = await fetchLeagueOdds(league.id, getSeason())
      for (const o of oddsList) {
        // Find a match involving both teams
        const fixture = (o as any).fixture
        if (!fixture) continue
        const home = fixture.teams?.home?.name || ''
        const away = fixture.teams?.away?.name || ''
        if (
          (home.toLowerCase().includes(homeTeamName.toLowerCase()) && away.toLowerCase().includes(awayTeamName.toLowerCase())) ||
          (home.toLowerCase().includes(awayTeamName.toLowerCase()) && away.toLowerCase().includes(homeTeamName.toLowerCase()))
        ) {
          const bm = o.bookmakers?.[0]
          const h2h = bm?.bets?.find((b: any) => b.name === 'Match Winner')
          const h2hValues = h2h?.values || []
          if (h2hValues.length >= 2) {
            const homeOdd = h2hValues.find((v: any) => v.value === 'Home')?.odd
            const drawOdd = h2hValues.find((v: any) => v.value === 'Draw')?.odd
            const awayOdd = h2hValues.find((v: any) => v.value === 'Away')?.odd
            if (homeOdd && awayOdd) {
              const parts = [`Home: ${(homeOdd / 100 + 1).toFixed(2)}`]
              if (drawOdd) parts.push(`Draw: ${(drawOdd / 100 + 1).toFixed(2)}`)
              parts.push(`Away: ${(awayOdd / 100 + 1).toFixed(2)}`)
              if (bm?.name) parts.push(`Bookmaker: ${bm.name}`)
              return {
                label: 'BETTING ODDS [LIVE]',
                truthClass: 'REAL' as const,
                content: `${parts.join(' · ')} (source: api-sports live)`,
              }
            }
          }
        }
      }
    }
  } catch { /* silent */ }

  return { label: 'BETTING ODDS', truthClass: 'MISSING', content: `No odds data found for ${homeTeamName} vs ${awayTeamName}.` }
}

async function buildStandingSection(teamName: string): Promise<EvidenceSection> {
  // Use dynamic season to match what frontend queries
  const season = getSeasonStr()

  const standing = await db.standingEntry.findFirst({
    where: { teamName: { contains: teamName, mode: 'insensitive' } },
    orderBy: { lastSyncedAt: 'desc' },
  })

  if (standing) {
    return {
      label: 'LEAGUE STANDING',
      truthClass: 'REAL',
      content: `${standing.teamName}: Rank ${standing.rank} · ${standing.played}P ${standing.wins}W-${standing.draws}D-${standing.losses}L · ${standing.points}pts · GD ${standing.goalDiff >= 0 ? '+' : ''}${standing.goalDiff} · ${standing.competition}${standing.season ? ` ${standing.season}` : ''}${standing.form ? ` · Form: ${standing.form}` : ''} (source: ${standing.source})`,
    }
  }

  // LIVE FALLBACK: fetch from API-Sports on the fly
  try {
    return await fetchLiveStandingSection(teamName)
  } catch (err) {
    return { label: 'LEAGUE STANDING', truthClass: 'MISSING', content: `No standing entry found for "${teamName}". Live lookup failed: ${err instanceof Error ? err.message : 'unknown'}` }
  }
}

// ── Live API Helpers ──────────────────────────────────────────────────────

/**
 * Search all API-Sports leagues for a team in standings, return the ASStandingTeam or null.
 */
async function findLiveStanding(teamName: string): Promise<ASStandingTeam | null> {
  const season = getSeason()
  for (const league of AS_LEAGUES) {
    try {
      const standingsGroups = await fetchASStandings(league.id, season)
      for (const group of standingsGroups) {
        const match = group.find(
          e => e.team.name.toLowerCase().includes(teamName.toLowerCase())
            || teamName.toLowerCase().includes(e.team.name.toLowerCase())
        )
        if (match) return match
      }
    } catch {
      continue
    }
  }
  return null
}

/** Build a LEAGUE STANDING evidence section from live API-Sports data */
async function fetchLiveStandingSection(teamName: string): Promise<EvidenceSection> {
  const standing = await findLiveStanding(teamName)
  if (!standing) {
    // Final fallback: try ESPN
    try {
      const leagueCodes = ['PL', 'LIGA', 'SA', 'BL', 'L1', 'UCL', 'UEL']
      for (const code of leagueCodes) {
        const espnStandings = await fetchESPNStandings(code)
        const espnMatch = espnStandings.find(s =>
          s.team.toLowerCase().includes(teamName.toLowerCase())
          || teamName.toLowerCase().includes(s.team.toLowerCase())
        )
        if (espnMatch) {
          return {
            label: 'LEAGUE STANDING [LIVE]',
            truthClass: 'REAL' as const,
            content: `${espnMatch.team}: Rank ${espnMatch.rank} · ${espnMatch.played}P ${espnMatch.wins}W-${espnMatch.draws}D-${espnMatch.losses}L · ${espnMatch.points}pts · GD ${espnMatch.goalDiff >= 0 ? '+' : ''}${espnMatch.goalDiff}${espnMatch.form ? ` · Form: ${espnMatch.form}` : ''} (source: ESPN live)`,
          }
        }
      }
    } catch { /* silent */ }

    return { label: 'LEAGUE STANDING', truthClass: 'MISSING' as const, content: `No standing data found for "${teamName}" in any league (checked API-Sports + ESPN).` }
  }

  const league = AS_LEAGUES.find(l => {
    // We don't know which league it was found in, but we can include the team info
    return true
  })
  const form = standing.form || 'N/A'
  return {
    label: 'LEAGUE STANDING [LIVE]',
    truthClass: 'REAL' as const,
    content: `${standing.team.name}: Rank ${standing.rank} · ${standing.all.played}P ${standing.all.win}W-${standing.all.draw}D-${standing.all.lose}L · ${standing.points}pts · GD ${standing.goalsDiff >= 0 ? '+' : ''}${standing.goalsDiff} · Season ${getSeason()}${form !== 'N/A' ? ` · Form: ${form}` : ''} (source: api-sports live, not cached in DB)`,
  }
}

/**
 * Try to find H2H data between two team names via API-Sports.
 */
async function buildH2HSection(homeTeamName: string, awayTeamName: string): Promise<EvidenceSection> {
  // Try to find API-Sports team IDs from standings
  let homeId: number | null = null
  let awayId: number | null = null

  for (const league of AS_LEAGUES.slice(0, 5)) {
    try {
      const season = getSeason()
      const groups = await fetchASStandings(league.id, season)
      for (const group of groups) {
        for (const entry of group) {
          if (!homeId && entry.team.name.toLowerCase().includes(homeTeamName.toLowerCase())) {
            homeId = entry.team.id
          }
          if (!awayId && entry.team.name.toLowerCase().includes(awayTeamName.toLowerCase())) {
            awayId = entry.team.id
          }
        }
      }
    } catch { continue }
    if (homeId && awayId) break
  }

  if (homeId && awayId) {
    try {
      const h2h = await fetchHeadToHead(`${homeId}-${awayId}`, 5)
      if (h2h.length > 0) {
        const lines = h2h.map(m => {
          const date = m.fixture.date?.slice(0, 10) || 'unknown'
          const homeGoals = m.goals.home ?? '?'
          const awayGoals = m.goals.away ?? '?'
          const league = m.league?.name || ''
          return `- ${date}: ${m.teams.home.name} ${homeGoals}-${awayGoals} ${m.teams.away.name} (${league})`
        })
        return {
          label: 'HEAD-TO-HEAD [LIVE]',
          truthClass: 'REAL',
          content: `Last ${h2h.length} meetings:\n${lines.join('\n')}`,
        }
      }
    } catch { /* silent */ }
  }

  return { label: 'HEAD-TO-HEAD', truthClass: 'MISSING', content: `No H2H data found for ${homeTeamName} vs ${awayTeamName}.` }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Builds a bounded, provenance-tagged evidence package for a chat request.
 *
 * Every section is tagged REAL, DERIVED, or MISSING. MISSING sections are included
 * explicitly so the LLM (and user) can see what evidence does and doesn't exist.
 *
 * When DB data is missing, falls back to live API calls (API-Sports, ESPN).
 */
export async function buildEvidence(params: {
  message: string
  matchId?: string | null
}): Promise<EvidencePackage> {
  const sections: EvidenceSection[] = []

  if (params.matchId) {
    // ── Match context path: we have a specific match ────────────────────
    const { section: matchSection, match } = await buildMatchSection(params.matchId)
    sections.push(matchSection)

    if (match) {
      // Form + analytics + news for both teams
      if (match.homeTeam) {
        sections.push(await buildTeamFormSection(match.homeTeam, match.homeTeam.name))
        sections.push(await buildTeamAnalyticsSection(match.homeTeam))
        sections.push({ ...(await buildNewsSection(match.homeTeam.name)), label: `RECENT NEWS — ${match.homeTeam.name}` })
        sections.push(await buildStandingSection(match.homeTeam.name))
      }
      if (match.awayTeam) {
        sections.push(await buildTeamFormSection(match.awayTeam, match.awayTeam.name))
        sections.push(await buildTeamAnalyticsSection(match.awayTeam))
        sections.push({ ...(await buildNewsSection(match.awayTeam.name)), label: `RECENT NEWS — ${match.awayTeam.name}` })
        sections.push(await buildStandingSection(match.awayTeam.name))
      }

      // Odds for this fixture
      if (match.homeTeam?.name && match.awayTeam?.name) {
        sections.push(await buildOddsSection(match.homeTeam.name, match.awayTeam.name))
        sections.push(await buildH2HSection(match.homeTeam.name, match.awayTeam.name))
      }

      // Existing prediction
      sections.push(await buildExistingPredictionSection(params.matchId))
    }
  } else {
    // ── No matchId: extract team names and build evidence ───────────────
    const teams = await extractTeamsFromMessage(params.message)

    if (teams.length >= 1) {
      const team1 = teams[0]
      sections.push(await buildTeamFormSection(team1, team1.name))
      sections.push(await buildTeamAnalyticsSection(team1))
      sections.push(await buildNewsSection(team1.name))
      sections.push(await buildStandingSection(team1.name))

      if (teams.length >= 2) {
        const team2 = teams[1]
        sections.push(await buildTeamFormSection(team2, team2.name))
        sections.push(await buildTeamAnalyticsSection(team2))
        sections.push({ ...(await buildNewsSection(team2.name)), label: `RECENT NEWS — ${team2.name}` })
        sections.push(await buildStandingSection(team2.name))
        sections.push(await buildOddsSection(team1.name, team2.name))
        sections.push(await buildH2HSection(team1.name, team2.name))
      }
    } else {
      // No teams found in DB — try live standing lookup for any identifiable name
      const words = params.message.split(/\s+/).filter(w => w.length > 4)
      const fallbackTeamName = words[0] || ''

      // Try multi-word patterns against live API
      let liveTeamFound = false
      for (const pattern of MULTI_WORD_TEAMS) {
        if (params.message.toLowerCase().includes(pattern.toLowerCase())) {
          const liveStanding = await fetchLiveStandingSection(pattern)
          if (liveStanding.truthClass === 'REAL') {
            sections.push(liveStanding)
            sections.push({
              label: 'CONTEXT',
              truthClass: 'MISSING',
              content: `Team data for "${pattern}" was fetched live. Form analytics and news are not cached in DB yet.`,
            })
            liveTeamFound = true
            break
          }
        }
      }

      if (!liveTeamFound && fallbackTeamName) {
        const liveStanding = await fetchLiveStandingSection(fallbackTeamName)
        if (liveStanding.truthClass === 'REAL') {
          sections.push(liveStanding)
          sections.push({
            label: 'CONTEXT',
            truthClass: 'MISSING',
            content: `Team data for "${fallbackTeamName}" was fetched live from APIs. Full analytics not yet available — run sync to populate DB.`,
          })
        } else {
          sections.push({
            label: 'CONTEXT',
            truthClass: 'MISSING',
            content: 'No specific team or match was identified in this message. Answering from general football knowledge only — no live ELASTICO data was retrieved.',
          })
        }
      } else if (!liveTeamFound) {
        sections.push({
          label: 'CONTEXT',
          truthClass: 'MISSING',
          content: 'No specific team or match was identified. Answering from general football knowledge.',
        })
      }
    }
  }

  // ── Format, bounded to MAX_EVIDENCE_CHARS ─────────────────────────────
  let formatted = sections
    .map(s => `### ${s.label} [${s.truthClass}]\n${s.content}`)
    .join('\n\n')

  if (formatted.length > MAX_EVIDENCE_CHARS) {
    formatted = formatted.slice(0, MAX_EVIDENCE_CHARS) + '\n\n[evidence truncated for length]'
  }

  return { sections, formatted, charCount: formatted.length }
}
