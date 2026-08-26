import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// ── Server-side response cache (in-memory, per-instance) ─────────────────────
const matchCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30_000 // 30 seconds

function getCached(id: string): any | null {
  const entry = matchCache.get(id)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data
  if (entry) matchCache.delete(id)
  return null
}
function setCache(id: string, data: any) {
  matchCache.set(id, { data, timestamp: Date.now() })
  // Evict oldest entries if cache grows too large
  if (matchCache.size > 200) {
    const oldest = [...matchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < 50; i++) matchCache.delete(oldest[i][0])
  }
}

// Normalize external status values to Elastico internal statuses
const STATUS_MAP: Record<string, string> = {
  'SCHEDULED': 'upcoming', 'TIMED': 'upcoming', 'STATUS_SCHEDULED': 'upcoming',
  'IN_PLAY': 'live', 'IN_PROGRESS': 'live', 'LIVE': 'live',
  'PAUSED': 'halftime', 'STATUS_HALFTIME': 'halftime', 'HT': 'halftime',
  'FINISHED': 'finished', 'STATUS_FINAL': 'finished', 'FULL_TIME': 'finished',
  'POSTPONED': 'postponed', 'CANCELLED': 'postponed', 'SUSPENDED': 'postponed',
}
function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'upcoming'
  return STATUS_MAP[status] || status
}

function mapDbMatch(m: any, homeAnalytics?: any, awayAnalytics?: any) {
  const teamMap = (t: any, analytics?: any) => ({
    id: t.id, name: t.name, code: t.code || '', logo: t.logo,
    primaryColor: t.primaryColor, secondaryColor: t.secondaryColor,
    eloRating: t.eloRating ?? 1500, form: '',
    wins: t.wins ?? 0, draws: t.draws ?? 0, losses: t.losses ?? 0,
    goalsFor: t.goalsFor ?? 0, goalsAgainst: t.goalsAgainst ?? 0,
    xgPerGame: analytics?.xgPerGame ?? null,
    xgaPerGame: analytics?.xgaPerGame ?? null,
    xgTruthClass: analytics?.truthClass ?? null,
    xgSource: analytics?.source ?? null,
    xgFreshness: analytics?.dataFreshness ?? null,
    possession: t.possession ?? null, passAccuracy: t.passAccuracy ?? null, pressIntensity: t.pressIntensity ?? null,
  })

  return {
    id: m.id,
    externalId: m.externalId,
    competition: m.competition,
    competitionCode: m.competitionCode,
    stage: m.round || '',
    group: null,
    date: m.date?.toISOString?.() || null,
    status: normalizeStatus(m.status),
    minute: m.minute,
    venue: m.venue,
    homeScore: m.homeScore ?? 0,
    awayScore: m.awayScore ?? 0,
    halfTimeHome: m.halfTimeHome,
    halfTimeAway: m.halfTimeAway,
    homeXg: m.homeXg ?? null,
    awayXg: m.awayXg ?? null,
    homeXgSource: m.homeXgSource ?? null,
    awayXgSource: m.awayXgSource ?? null,
    homeXgTruthClass: m.homeXgTruthClass ?? null,
    awayXgTruthClass: m.awayXgTruthClass ?? null,
    possessionHome: m.possessionHome ?? null,
    possessionAway: m.possessionAway ?? null,
    shotsHome: m.shotsHome ?? 0,
    shotsAway: m.shotsAway ?? 0,
    shotsOnTargetHome: m.shotsOnTargetHome ?? 0,
    shotsOnTargetAway: m.shotsOnTargetAway ?? 0,
    cornersHome: m.cornersHome ?? 0,
    cornersAway: m.cornersAway ?? 0,
    homeWinProb: null, drawProb: null, awayWinProb: null,
    homeEloBefore: m.homeTeam?.eloRating ?? null,
    awayEloBefore: m.awayTeam?.eloRating ?? null,
    isSimulated: false,
    homeTeam: teamMap(m.homeTeam, homeAnalytics),
    awayTeam: teamMap(m.awayTeam, awayAnalytics),
    events: (m.events || []).map((e: any) => ({
      id: e.id, minute: e.minute, type: e.type, detail: e.detail,
      team: e.team, playerName: e.playerName, playerPhoto: e.playerPhoto,
      assistName: e.assistName, description: e.detail,
    })),
    voteDistribution: { home: 0, draw: 0, away: 0 },
    votes: [], predictions: [],
    _count: { predictions: 0, events: m.events?.length || 0 },
    source: m.source,
    lastSyncedAt: m.lastSyncedAt?.toISOString?.() || null,
    createdAt: m.createdAt?.toISOString?.() || '',
    updatedAt: m.updatedAt?.toISOString?.() || '',
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ── Detect source prefix (fd:, espn:, api-sports:) ────────────────────
    const prefixMatch = id.match(/^(fd|espn|api-sports):(.+)/)
    const hasPrefix = !!prefixMatch
    const rawExternalId = hasPrefix ? prefixMatch[2] : id
    const sourcePrefix = hasPrefix ? prefixMatch[1] : null

    // Shared helper to enrich a DB match with xG analytics
    const enrichMatch = async (dbMatch: any) => {
      const findAnalytics = async (teamName: string, teamId: string) => {
        const legacy = await db.teamAnalytic.findFirst({
          where: { teamId, source: 'understat' },
          orderBy: { syncedAt: 'desc' },
        })
        if (legacy) return legacy
        const canonical = await db.canonicalTeam.findFirst({
          where: { displayName: { equals: teamName, mode: 'insensitive' } },
          include: { analytics: { orderBy: { syncedAt: 'desc' }, take: 1 } },
        })
        return canonical?.analytics[0] ?? null
      }
      const [homeAnalytics, awayAnalytics] = await Promise.all([
        findAnalytics(dbMatch.homeTeam?.name || '', dbMatch.homeTeamId),
        findAnalytics(dbMatch.awayTeam?.name || '', dbMatch.awayTeamId),
      ])
      return mapDbMatch(dbMatch, homeAnalytics, awayAnalytics)
    }
    const matchIncludes = {
      homeTeam: true,
      awayTeam: true,
      events: { orderBy: { minute: 'asc' as const } },
    }

    // ── 0. Check cache ────────────────────────────────────────────────
    const cached = getCached(id)
    if (cached) {
      return NextResponse.json(cached)
    }

    // ── 1. Try database by primary ID (only if no source prefix) ──────────
    if (!hasPrefix) {
      try {
        const dbMatch = await db.match.findUnique({
          where: { id },
          include: matchIncludes,
        }) as any
        if (dbMatch) {
          const result = { match: await enrichMatch(dbMatch), source: 'database' }
          setCache(id, result)
          return NextResponse.json(result)
        }
      } catch (dbErr) {
        console.error('[MatchDetail] DB lookup failed, trying externalId:', dbErr)
      }
    }

    // ── 2. Try by externalId (stripped prefix) ────────────────────────────
    try {
      const dbMatch = await db.match.findFirst({
        where: { externalId: rawExternalId },
        include: matchIncludes,
      }) as any
      if (dbMatch) {
        const result = { match: await enrichMatch(dbMatch), source: 'database' }
        setCache(id, result)
        return NextResponse.json(result)
      }
    } catch (dbErr2) {
      console.error('[MatchDetail] externalId lookup failed:', dbErr2)
    }

    // ── 2.5. Fallback: fetch from football-data.org for fd: prefixed IDs ──
    if (sourcePrefix === 'fd' && process.env.FOOTBALL_DATA_API_KEY) {
      try {
        const { fetchMatches, normalizeFDMatch } = await import('@/lib/football-data-org')
        const competitions = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL']
        // Parallel fetch all competitions instead of sequential
        const allResults = await Promise.allSettled(
          competitions.map(comp => fetchMatches(comp).catch(() => []))
        )
        for (const result of allResults) {
          if (result.status !== 'fulfilled') continue
          const fdMatch = result.value.find((m: any) => String(m.id) === rawExternalId)
          if (fdMatch) {
            const normalized = normalizeFDMatch(fdMatch)
            const response = { match: normalized, source: 'football-data.org (live)' }
            setCache(id, response)
            return NextResponse.json(response)
          }
        }
      } catch (fdErr) {
        console.error('[MatchDetail] football-data.org fallback failed:', fdErr)
      }
    }

    // ── 3. Fallback: ESPN live data ────────────────────────────────────────
    try {
      const allMatches = await fetchAllLiveScores()
      // Match by full id OR stripped id (for prefixed IDs like espn:123)
      const espnMatch = allMatches.find((m) => m.id === id || m.id === rawExternalId)

      if (espnMatch) {
        const teamFromEspn = (t: any) => ({
          id: t.id, name: t.name, code: t.abbreviation || '', logo: t.logo,
          primaryColor: t.color || '#00e676', secondaryColor: '#ffffff',
          eloRating: 1500, form: '',
          wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
          xgPerGame: null, xgaPerGame: null,
          xgTruthClass: 'MISSING',
          xgSource: null, xgFreshness: null,
          possession: null, passAccuracy: null, pressIntensity: null,
        })
        const matchData = {
          id: espnMatch.id,
          competition: espnMatch.competition,
          competitionCode: (espnMatch as any).competitionCode || '',
          stage: '', group: null,
          date: espnMatch.date || null,
          status: normalizeStatus(espnMatch.status), minute: espnMatch.minute, venue: espnMatch.venue,
          homeScore: espnMatch.homeScore, awayScore: espnMatch.awayScore,
          halfTimeHome: null, halfTimeAway: null,
          homeXg: null, awayXg: null,
          homeXgSource: null, awayXgSource: null,
          homeXgTruthClass: 'MISSING', awayXgTruthClass: 'MISSING',
          possessionHome: null, possessionAway: null,
          shotsHome: 0, shotsAway: 0, shotsOnTargetHome: 0, shotsOnTargetAway: 0,
          cornersHome: 0, cornersAway: 0,
          homeWinProb: null, drawProb: null, awayWinProb: null,
          homeEloBefore: null, awayEloBefore: null, isSimulated: false,
          homeTeam: teamFromEspn(espnMatch.homeTeam),
          awayTeam: teamFromEspn(espnMatch.awayTeam),
          events: [],
          voteDistribution: { home: 0, draw: 0, away: 0 },
          votes: [], predictions: [],
          _count: { predictions: 0, events: 0 },
          source: 'espn',
        }
        const result = { match: matchData, source: 'espn' }
        setCache(id, result)
        return NextResponse.json(result)
      }
    } catch (espnErr) {
      console.error('[MatchDetail] ESPN lookup failed:', espnErr)
    }

    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  } catch (error) {
    console.error('Match detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth

    const { user } = auth
    const { id } = await params
    // Strip source prefixes for DB lookups
    const prefixMatch = id.match(/^(fd|espn|api-sports):(.+)/)
    const rawId = prefixMatch ? prefixMatch[2] : id
    const { choice } = await req.json()

    if (!choice || !['home', 'draw', 'away'].includes(choice)) {
      return NextResponse.json({ error: 'Choice must be home, draw, or away' }, { status: 400 })
    }

    // Try to find team names from DB first, then ESPN
    let homeTeamName = 'Home'
    let awayTeamName = 'Away'

    try {
      const dbMatch = await db.match.findUnique({ where: { id: rawId }, include: { homeTeam: true, awayTeam: true } }) as any
      if (dbMatch) {
        homeTeamName = dbMatch.homeTeam.name
        awayTeamName = dbMatch.awayTeam.name
      } else {
        const byExtId = await db.match.findFirst({ where: { externalId: rawId }, include: { homeTeam: true, awayTeam: true } }) as any
        if (byExtId) { homeTeamName = byExtId.homeTeam.name; awayTeamName = byExtId.awayTeam.name }
      }
    } catch {}

    if (homeTeamName === 'Home') {
      try {
        const allMatches = await fetchAllLiveScores()
        const espnMatch = allMatches.find((m) => m.id === id || m.id === rawId)
        if (espnMatch) { homeTeamName = espnMatch.homeTeam.name; awayTeamName = espnMatch.awayTeam.name }
      } catch {}
    }

    const vote = await db.vote.upsert({
      where: { userId_matchId: { userId: user.id, matchId: id } },
      update: { choice },
      create: { userId: user.id, matchId: id, choice, homeTeam: homeTeamName, awayTeam: awayTeamName },
    })

    await db.activity.create({
      data: { userId: user.id, type: 'vote', metadata: JSON.stringify({ matchId: id, choice }) },
    })

    return NextResponse.json({ vote })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
