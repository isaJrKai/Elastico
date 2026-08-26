import { db } from '@/lib/db'
import type { Team, NewsArticle, Prediction, TeamAnalytic } from '@prisma/client'

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

// ── Team lookup ────────────────────────────────────────────────────────────

/**
 * Attempts to find a real Team row matching a name fragment.
 * Plain SQL `contains` match — not fuzzy matching, not an embedding lookup.
 * Stage 1 limitation: will miss nicknames/aliases (e.g. "Spurs" won't match "Tottenham Hotspur")
 * unless the DB row's `name` contains that substring. Fails toward MISSING, not wrong guess.
 */
async function findTeamByName(nameFragment: string) {
  if (!nameFragment || nameFragment.length < 3) return null
  return db.team.findFirst({
    where: { name: { contains: nameFragment } },
  })
}

// ── Evidence sections ──────────────────────────────────────────────────────

async function buildTeamFormSection(team: Team | null): Promise<EvidenceSection> {
  if (!team) {
    return { label: 'TEAM FORM', truthClass: 'MISSING', content: 'No matching team record found in the database.' }
  }
  const played = team.wins + team.draws + team.losses
  if (played === 0) {
    return {
      label: 'TEAM FORM',
      truthClass: 'REAL',
      content: `${team.name}: ELO ${team.eloRating.toFixed(0)} (default/no match history recorded). Source: ${team.source}, synced ${team.lastSyncedAt.toISOString().slice(0, 10)}.`,
    }
  }
  const goalDiff = team.goalsFor - team.goalsAgainst
  const gdStr = goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`
  return {
    label: 'TEAM FORM',
    truthClass: 'REAL',
    content: `${team.name}: ELO ${team.eloRating.toFixed(0)} · Record ${team.wins}W-${team.draws}D-${team.losses}L (${played} played) · Goals ${team.goalsFor}F/${team.goalsAgainst}A (GD ${gdStr}) · League: ${team.league ?? 'unknown'} (source: ${team.source}, synced ${team.lastSyncedAt.toISOString().slice(0, 10)})`,
  }
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
  const articles = await db.newsArticle.findMany({
    where: {
      OR: [
        { title: { contains: teamName } },
        { summary: { contains: teamName } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  })

  if (articles.length === 0) {
    return { label: 'RECENT NEWS', truthClass: 'MISSING', content: `No recent news articles found mentioning "${teamName}".` }
  }

  const lines = articles.map(a => {
    const age = a.publishedAt ? `${Math.round((Date.now() - a.publishedAt.getTime()) / 3_600_000)}h ago` : 'undated'
    const summary = (a.summary || a.title).slice(0, 180)
    return `- [${age}, ${a.sourceName}] ${summary}`
  })

  return { label: 'RECENT NEWS', truthClass: 'REAL', content: lines.join('\n') }
}

async function buildMatchSection(matchId: string): Promise<{ section: EvidenceSection; match: MatchWithTeams | null }> {
  const match = await db.match.findFirst({
    where: { OR: [{ id: matchId }, { sourceId: matchId }] },
    include: { homeTeam: true, awayTeam: true },
  })

  if (!match) {
    return { section: { label: 'MATCH', truthClass: 'MISSING', content: `No match record found for id "${matchId}".` }, match: null }
  }

  // Match.status defaults to 'upcoming' and homeScore/awayScore default to 0.
  // We can't use null checks to detect "not started" — use status instead.
  const isNotStarted = match.status === 'upcoming' || match.status === 'scheduled'
  const scoreStr = isNotStarted ? 'not started' : `${match.homeScore}-${match.awayScore}`

  // xG fields — may be null (not yet available)
  const xgParts: string[] = []
  if (match.homeXg != null) xgParts.push(`Home xG: ${match.homeXg.toFixed(2)}`)
  if (match.awayXg != null) xgParts.push(`Away xG: ${match.awayXg.toFixed(2)}`)
  if (match.homeXgSource) xgParts.push(`(xG source: ${match.homeXgSource}, class: ${match.homeXgTruthClass ?? 'unknown'})`)

  const extraStats: string[] = []
  if (match.possessionHome != null) extraStats.push(`Possession: ${match.possessionHome.toFixed(0)}%-${(100 - match.possessionHome).toFixed(0)}%`)
  if (match.shotsHome != null) extraStats.push(`Shots: ${match.shotsHome}-${match.shotsAway ?? '?'}`)
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
    section: {
      label: 'MATCH',
      truthClass: 'REAL',
      content: contentParts.join(' · '),
    },
    match,
  }
}

async function buildExistingPredictionSection(matchId: string): Promise<EvidenceSection> {
  // Prediction.matchId is a String (ESPN ID, no FK to Match table),
  // so we search by both the Match.id (cuid) and Match.sourceId (ESPN ID)
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
  const odds = await db.oddsSnapshot.findFirst({
    where: {
      homeTeam: { contains: homeTeamName },
      awayTeam: { contains: awayTeamName },
    },
    orderBy: { fetchedAt: 'desc' },
  })

  if (!odds) {
    return { label: 'BETTING ODDS', truthClass: 'MISSING', content: `No odds data found for ${homeTeamName} vs ${awayTeamName}.` }
  }

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

async function buildStandingSection(teamName: string): Promise<EvidenceSection> {
  const standing = await db.standingEntry.findFirst({
    where: { teamName: { contains: teamName } },
    orderBy: { lastSyncedAt: 'desc' },
  })

  if (!standing) {
    return { label: 'LEAGUE STANDING', truthClass: 'MISSING', content: `No standing entry found for "${teamName}".` }
  }

  return {
    label: 'LEAGUE STANDING',
    truthClass: 'REAL',
    content: `${standing.teamName}: Rank ${standing.rank} · ${standing.played}P ${standing.wins}W-${standing.draws}D-${standing.losses}L · ${standing.points}pts · GD ${standing.goalDiff >= 0 ? '+' : ''}${standing.goalDiff} · ${standing.competition}${standing.season ? ` ${standing.season}` : ''}${standing.form ? ` · Form: ${standing.form}` : ''} (source: ${standing.source})`,
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Builds a bounded, provenance-tagged evidence package for a chat request.
 *
 * Stage 1 only: direct PostgreSQL lookups, no embeddings, no semantic search.
 * Every section is tagged REAL, DERIVED, or MISSING. MISSING sections are included
 * explicitly so the LLM (and user) can see what evidence does and doesn't exist.
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
        sections.push(await buildTeamFormSection(match.homeTeam))
        sections.push(await buildTeamAnalyticsSection(match.homeTeam))
        sections.push({ ...(await buildNewsSection(match.homeTeam.name)), label: `RECENT NEWS — ${match.homeTeam.name}` })
        sections.push(await buildStandingSection(match.homeTeam.name))
      }
      if (match.awayTeam) {
        sections.push(await buildTeamFormSection(match.awayTeam))
        sections.push(await buildTeamAnalyticsSection(match.awayTeam))
        sections.push({ ...(await buildNewsSection(match.awayTeam.name)), label: `RECENT NEWS — ${match.awayTeam.name}` })
        sections.push(await buildStandingSection(match.awayTeam.name))
      }

      // Odds for this fixture
      if (match.homeTeam?.name && match.awayTeam?.name) {
        sections.push(await buildOddsSection(match.homeTeam.name, match.awayTeam.name))
      }

      // Existing prediction
      sections.push(await buildExistingPredictionSection(params.matchId))
    }
  } else {
    // ── No matchId: lightweight heuristic team name extraction ───────────
    // Plain substring match against known team names. Will miss aliases —
    // that's an acceptable Stage 1 limitation. Fails toward MISSING.
    const words = params.message.split(/\s+/).filter(w => w.length > 3)
    let matchedTeam: Team | null = null
    for (const word of words) {
      matchedTeam = await findTeamByName(word)
      if (matchedTeam) break
    }

    if (matchedTeam) {
      sections.push(await buildTeamFormSection(matchedTeam))
      sections.push(await buildTeamAnalyticsSection(matchedTeam))
      sections.push(await buildNewsSection(matchedTeam.name))
      sections.push(await buildStandingSection(matchedTeam.name))
    } else {
      sections.push({
        label: 'CONTEXT',
        truthClass: 'MISSING',
        content: 'No specific team or match was identified in this message. Answering from general football knowledge only — no live ELASTICO data was retrieved.',
      })
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
