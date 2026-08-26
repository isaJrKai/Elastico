import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores, ESPN_LEAGUES } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const ESPN_SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/soccer'

async function fetchEspnSummary(leagueSlug: string, eventId: string): Promise<any | null> {
  try {
    const url = `${ESPN_SITE_V2}/${leagueSlug}/summary?event=${eventId}`
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
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
    // Rate limiting
    const ip = _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`match-detail:${ip}`, 30, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { id } = await params

    const t0 = performance.now()

    // ── Detect source prefix (fd:, espn:, api-sports:) ────────────────────
    const prefixMatch = id.match(/^(fd|espn|api-sports):(.+)/)
    const hasPrefix = !!prefixMatch
    const rawExternalId = hasPrefix ? prefixMatch[2] : id
    const sourcePrefix = hasPrefix ? prefixMatch[1] : null

    // Auto-infer ESPN prefix for pure numeric IDs (dashboard passes raw ESPN IDs)
    const looksLikeEspnId = !hasPrefix && /^\d+$/.test(id)
    const effectivePrefix = sourcePrefix || (looksLikeEspnId ? 'espn' : null)

    // Shared helper to enrich a DB match with xG analytics
    const enrichMatch = async (dbMatch: any) => {
      const findAnalytics = async (teamName: string, teamId: string) => {
        const legacy = await db.teamAnalytic.findFirst({
          where: { teamId, source: 'understat' },
          orderBy: { syncedAt: 'desc' },
        })
        if (legacy) return legacy
        const canonical = await db.canonicalTeam.findFirst({
          where: { displayName: { equals: teamName } },
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
      console.log(`[MatchDetail] CACHE HIT id="${id}" (${((performance.now() - t0) | 0)}ms)`)
      return NextResponse.json(cached)
    }
    console.log(`[MatchDetail] id="${id}" hasPrefix=${hasPrefix} sourcePrefix=${sourcePrefix} rawExternalId="${rawExternalId}"`)

    // ── 1. Try database by primary ID (only if no source prefix and not a numeric ESPN ID) ──
    if (!hasPrefix && !looksLikeEspnId) {
      const t1 = performance.now()
      try {
        const dbMatch = await db.match.findUnique({
          where: { id },
          include: matchIncludes,
        }) as any
        if (dbMatch) {
          console.log(`[MatchDetail] STAGE 1 HIT: database by primary id="${id}" (${((performance.now() - t1) | 0)}ms)`)
          const result = { match: await enrichMatch(dbMatch), source: 'database' }
          setCache(id, result)
          return NextResponse.json(result)
        }
        console.log(`[MatchDetail] STAGE 1 MISS: no DB row with id="${id}" (${((performance.now() - t1) | 0)}ms)`)
      } catch (dbErr) {
        console.error(`[MatchDetail] STAGE 1 ERROR: DB lookup failed (${((performance.now() - t1) | 0)}ms):`, dbErr)
      }
    } else {
      console.log(`[MatchDetail] STAGE 1 SKIPPED: has prefix "${sourcePrefix}:"`)
    }

    // ── 2. Try by externalId (stripped prefix) ────────────────────────────
    const t2 = performance.now()
    try {
      const dbMatch = await db.match.findFirst({
        where: { externalId: rawExternalId },
        include: matchIncludes,
      }) as any
      if (dbMatch) {
        console.log(`[MatchDetail] STAGE 2 HIT: database by externalId="${rawExternalId}" (${((performance.now() - t2) | 0)}ms)`)
        const result = { match: await enrichMatch(dbMatch), source: 'database' }
        setCache(id, result)
        return NextResponse.json(result)
      }
      console.log(`[MatchDetail] STAGE 2 MISS: no DB row with externalId="${rawExternalId}" (${((performance.now() - t2) | 0)}ms)`)
    } catch (dbErr2) {
      console.error(`[MatchDetail] STAGE 2 ERROR: externalId lookup failed (${((performance.now() - t2) | 0)}ms):`, dbErr2)
    }

    // ── Track honest error messages from each stage ─────────────────────
    let apiSportsError: string | null = null
    let fdError: string | null = null

    // ── 2.5. Fallback: fetch from football-data.org for fd: prefixed IDs ──
    if (sourcePrefix === 'fd') {
      const hasKey = !!process.env.FOOTBALL_DATA_API_KEY
      const t25 = performance.now()
      console.log(`[MatchDetail] STAGE 2.5: sourcePrefix=fd, FOOTBALL_DATA_API_KEY=${hasKey ? 'present' : 'MISSING'}`)
      if (hasKey) {
        try {
          const { fetchMatches, normalizeFDMatch } = await import('@/lib/football-data-org')
          const competitions = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL']
          const allResults = await Promise.allSettled(
            competitions.map(comp => fetchMatches(comp).catch(() => []))
          )
          let totalFetched = 0
          for (const result of allResults) {
            if (result.status !== 'fulfilled') continue
            totalFetched += result.value.length
            const fdMatch = result.value.find((m: any) => String(m.id) === rawExternalId)
            if (fdMatch) {
              console.log(`[MatchDetail] STAGE 2.5 HIT: football-data.org found match (${totalFetched} matches, ${competitions.length} comps, ${((performance.now() - t25) | 0)}ms)`)
              const normalized = normalizeFDMatch(fdMatch)
              const response = { match: normalized, source: 'football-data.org (live)' }
              setCache(id, response)
              return NextResponse.json(response)
            }
          }
          console.log(`[MatchDetail] STAGE 2.5 MISS: football-data.org no match for id="${rawExternalId}" (${totalFetched} searched, ${((performance.now() - t25) | 0)}ms)`)
        } catch (fdErr) {
          console.error(`[MatchDetail] STAGE 2.5 ERROR: football-data.org failed (${((performance.now() - t25) | 0)}ms):`, fdErr)
          fdError = `football-data.org error: ${fdErr instanceof Error ? fdErr.message : String(fdErr)}`
        }
      } else {
        fdError = 'FOOTBALL_DATA_API_KEY not configured'
      }
    } else {
      console.log(`[MatchDetail] STAGE 2.5 SKIPPED: sourcePrefix is "${sourcePrefix}", not "fd"`)
    }

    // ── 3. Fallback: ESPN scoreboard (live/today data) ─────────────────────
    const t3 = performance.now()
    console.log(`[MatchDetail] STAGE 3: ESPN scoreboard, rawExternalId="${rawExternalId}"`)
    try {
      const allMatches = await fetchAllLiveScores()
      console.log(`[MatchDetail] STAGE 3: ESPN returned ${allMatches.length} matches (${((performance.now() - t3) | 0)}ms)`)
      // Match by stripped raw ID (the ESPN event ID) — never match against the full id
      // because it may contain a prefix like fd:123 which won't match any ESPN ID
      const espnMatch = allMatches.find((m) => m.id === rawExternalId)

      if (espnMatch) {
        console.log(`[MatchDetail] STAGE 3 HIT: ESPN found "${espnMatch.homeTeam?.name} vs ${espnMatch.awayTeam?.name}" (${((performance.now() - t3) | 0)}ms)`)
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
      console.log(`[MatchDetail] STAGE 3 MISS: ESPN scoreboard no match for id="${rawExternalId}" (${((performance.now() - t3) | 0)}ms)`)
    } catch (espnErr) {
      console.error('[MatchDetail] STAGE 3 ERROR: ESPN scoreboard lookup failed:', espnErr)
    }

    // ── 3b. Fallback: ESPN per-match summary (works for past/off-scoreboard matches) ──
    const isNumericId = /^\d+$/.test(rawExternalId)
    if (isNumericId) {
      const t3b = performance.now()
      console.log(`[MatchDetail] STAGE 3b: ESPN summary endpoint for numeric id="${rawExternalId}"`)
      const summaryResults = await Promise.allSettled(
        ESPN_LEAGUES.map(l => fetchEspnSummary(l.espnId, rawExternalId))
      )
      for (const r of summaryResults) {
        if (r.status !== 'fulfilled' || !r.value) continue
        const boxscore = r.value.boxscore
        if (!boxscore) continue
        const comp = r.value.header?.competitions?.[0]
        if (!comp) continue
        const home = comp.competitors?.find((c: any) => c.homeAway === 'home') || comp.competitors?.[0]
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away') || comp.competitors?.[1]
        if (!home || !away) continue
        console.log(`[MatchDetail] STAGE 3b HIT: ESPN summary found "${home.team?.displayName} vs ${away.team?.displayName}" (${((performance.now() - t3b) | 0)}ms)`)
        const teamFromEspn = (c: any) => ({
          id: c.team?.id || '', name: c.team?.displayName || 'Unknown', code: c.team?.abbreviation || '',
          logo: c.team?.logo || '', primaryColor: c.team?.color || '#00e676', secondaryColor: '#ffffff',
          eloRating: 1500, form: '', wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
          xgPerGame: null, xgaPerGame: null, xgTruthClass: 'MISSING', xgSource: null, xgFreshness: null,
          possession: null, passAccuracy: null, pressIntensity: null,
        })
        const statusDetail = comp.status?.type?.detail || ''
        const minuteMatch = statusDetail.match(/(\d+)\s*'/)
        const matchData = {
          id: rawExternalId,
          competition: comp.name || r.value.header?.name || '',
          competitionCode: '', stage: '', group: null,
          date: r.value.header?.date || comp.startDate || null,
          status: normalizeStatus(comp.status?.type?.name), minute: minuteMatch ? parseInt(minuteMatch[1]) : undefined,
          venue: comp.venue?.fullName || '',
          homeScore: parseInt(home.score) || 0, awayScore: parseInt(away.score) || 0,
          halfTimeHome: null, halfTimeAway: null,
          homeXg: null, awayXg: null, homeXgSource: null, awayXgSource: null,
          homeXgTruthClass: 'MISSING', awayXgTruthClass: 'MISSING',
          possessionHome: null, possessionAway: null,
          shotsHome: parseInt(home.statistics?.find((s: any) => s.name === 'shotsTotal')?.displayValue) || 0,
          shotsAway: parseInt(away.statistics?.find((s: any) => s.name === 'shotsTotal')?.displayValue) || 0,
          shotsOnTargetHome: parseInt(home.statistics?.find((s: any) => s.name === 'shotsOnTarget')?.displayValue) || 0,
          shotsOnTargetAway: parseInt(away.statistics?.find((s: any) => s.name === 'shotsOnTarget')?.displayValue) || 0,
          cornersHome: parseInt(home.statistics?.find((s: any) => s.name === 'cornersTotal')?.displayValue) || 0,
          cornersAway: parseInt(away.statistics?.find((s: any) => s.name === 'cornersTotal')?.displayValue) || 0,
          homeWinProb: null, drawProb: null, awayWinProb: null, homeEloBefore: null, awayEloBefore: null,
          isSimulated: false,
          homeTeam: teamFromEspn(home), awayTeam: teamFromEspn(away),
          events: [], voteDistribution: { home: 0, draw: 0, away: 0 }, votes: [], predictions: [],
          _count: { predictions: 0, events: 0 }, source: 'espn-summary',
        }
        const result = { match: matchData, source: 'espn (summary)' }
        setCache(id, result)
        return NextResponse.json(result)
      }
      console.log(`[MatchDetail] STAGE 3b MISS: no ESPN league returned summary for id="${rawExternalId}" (${((performance.now() - t3b) | 0)}ms)`)
    } else {
      console.log(`[MatchDetail] STAGE 3b SKIPPED: id is not numeric ("${rawExternalId}")`)
    }

    // ── 4. Fallback: API-Sports (for api-sports: prefixed or numeric IDs) ──
    const hasAsKey = !!process.env.API_SPORTS_KEY
    if (sourcePrefix === 'api-sports' || (isNumericId && hasAsKey)) {
      const t4 = performance.now()
      console.log(`[MatchDetail] STAGE 4: sourcePrefix=${sourcePrefix}, API_SPORTS_KEY=${hasAsKey ? 'present' : 'MISSING'}`)
      if (hasAsKey) {
        try {
          const { normalizeASFixture } = await import('@/lib/api-sports')
          const AS_BASE = 'https://v3.football.api-sports.io'
          const fixtureRes = await fetch(`${AS_BASE}/fixtures?id=${rawExternalId}`, {
            headers: { 'x-apisports-key': process.env.API_SPORTS_KEY! },
            next: { revalidate: 120 },
          })
          const fixtureData = await fixtureRes.json()
          // API-Sports returns HTTP 200 even on auth errors — check for error object
          const asError = fixtureData.errors?.token || fixtureData.errors?.message
          if (asError) {
            console.error(`[MatchDetail] STAGE 4 AUTH ERROR: API-Sports rejected key: "${asError}" (${((performance.now() - t4) | 0)}ms)`)
            apiSportsError = `API-Sports auth failed: ${asError}`
          } else {
            const fixture = fixtureData.response?.[0]
            if (fixture) {
              console.log(`[MatchDetail] STAGE 4 HIT: API-Sports fixture found "${fixture.teams?.home?.name} vs ${fixture.teams?.away?.name}" (${((performance.now() - t4) | 0)}ms)`)
              const normalized = normalizeASFixture(fixture)
              const matchData = {
                ...normalized,
                id: rawExternalId,
                homeXg: null, awayXg: null,
                homeXgSource: null, awayXgSource: null,
                homeXgTruthClass: 'MISSING', awayXgTruthClass: 'MISSING',
                possessionHome: null, possessionAway: null,
                homeWinProb: null, drawProb: null, awayWinProb: null,
                homeEloBefore: null, awayEloBefore: null, isSimulated: false,
                events: [], voteDistribution: { home: 0, draw: 0, away: 0 },
                votes: [], predictions: [],
                _count: { predictions: 0, events: 0 },
                source: 'api-sports',
              }
              const result = { match: matchData, source: 'api-sports' }
              setCache(id, result)
              return NextResponse.json(result)
            }
            console.log(`[MatchDetail] STAGE 4 MISS: API-Sports /fixtures returned no match for id="${rawExternalId}" (${((performance.now() - t4) | 0)}ms)`)
          }
        } catch (asErr) {
          console.error(`[MatchDetail] STAGE 4 ERROR: API-Sports fallback failed (${((performance.now() - t4) | 0)}ms):`, asErr)
          apiSportsError = `API-Sports fetch error: ${asErr instanceof Error ? asErr.message : String(asErr)}`
        }
      } else {
        console.log(`[MatchDetail] STAGE 4 SKIPPED: API_SPORTS_KEY not configured`)
        apiSportsError = 'API_SPORTS_KEY not configured'
      }
    } else {
      console.log(`[MatchDetail] STAGE 4 SKIPPED: sourcePrefix="${sourcePrefix}", not api-sports and no AS key`)
    }

    // ── 5. All fallbacks exhausted ────────────────────────────────────────
    console.log(`[MatchDetail] ALL STAGES EXHAUSTED for id="${id}" (prefix=${effectivePrefix}, rawId="${rawExternalId}", total=${((performance.now() - t0) | 0)}ms)`)
    const stagesAttempted = [
      'database:id',
      'database:externalId',
      sourcePrefix === 'fd' ? 'football-data.org' : null,
      'espn:scoreboard',
      isNumericId ? 'espn:summary' : null,
      (sourcePrefix === 'api-sports' || (isNumericId && hasAsKey)) ? 'api-sports' : null,
    ].filter(Boolean)
    const providerErrors: Record<string, string> = {}
    if (fdError) providerErrors['football-data.org'] = fdError
    if (apiSportsError) providerErrors['api-sports'] = apiSportsError
    return NextResponse.json({
      error: 'Match not found',
      id,
      effectivePrefix,
      rawExternalId,
      isNumericId,
      stagesAttempted,
      providerErrors: Object.keys(providerErrors).length > 0 ? providerErrors : undefined,
      hint: apiSportsError?.includes('auth failed')
        ? `API-Sports key is invalid (provider rejected it). ESPN fallback also found no match. ${isNumericId ? 'Try an ESPN event ID from today\'s or recent matches.' : 'Use prefix espn: for ESPN IDs.'}`
        : fdError?.includes('not configured')
        ? 'football-data.org requires an API key (FOOTBALL_DATA_API_KEY). Use prefix espn: for ESPN IDs which need no key.'
        : isNumericId
        ? 'The ID looks like an ESPN event ID but was not found on any ESPN league scoreboard or summary. The match may be from a league not yet configured, or the ESPN API returned an error.'
        : looksLikeEspnId
        ? 'This ID appears to be an ESPN event ID. It was not found in the database or ESPN live data.'
        : !hasPrefix
        ? 'No source prefix detected. Try prefixing with fd: (football-data.org), espn: (ESPN), or api-sports: (API-Sports) to help the fallback chain.'
        : `Source prefix "${sourcePrefix}:" was recognized but the ID was not found via any available fallback for that source.`,
    }, { status: 404 })
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
