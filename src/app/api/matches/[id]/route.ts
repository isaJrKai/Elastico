import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

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
    players: (t.players || []).map((p: any) => ({
      id: p.id, name: p.name, number: p.number || 0,
      position: p.position || '', goals: p.goals || 0, assists: p.assists || 0,
      yellowCards: p.yellowCards || 0, redCards: p.redCards || 0,
      rating: p.rating ?? 0, marketValue: null, age: p.age,
    })),
  })

  return {
    id: m.id,
    externalId: m.externalId,
    competition: m.competition,
    competitionCode: m.competitionCode,
    stage: m.round || '',
    group: null,
    date: m.date?.toISOString?.() || null,
    status: m.status || 'upcoming',
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

    // ── 1. Try database by primary ID ──────────────────────────────────────
    try {
      const dbMatch = await db.match.findUnique({
        where: { id },
        include: {
          homeTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          awayTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          events: { orderBy: { minute: 'asc' } },
        },
      }) as any

      if (dbMatch) {
        // Fetch xG analytics: try legacy teamId first, then CanonicalTeam name match
        const findAnalytics = async (teamName: string, teamId: string) => {
          // Try legacy TeamAnalytic by teamId
          const legacy = await db.teamAnalytic.findFirst({
            where: { teamId, source: 'understat' },
            orderBy: { syncedAt: 'desc' },
          })
          if (legacy) return legacy
          // Try CanonicalTeam-based analytic by name
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
        return NextResponse.json({ match: mapDbMatch(dbMatch, homeAnalytics, awayAnalytics), source: 'database' })
      }
    } catch (dbErr) {
      console.error('[MatchDetail] DB lookup failed, trying externalId:', dbErr)
    }

    // ── 2. Try by externalId (API-Sports ID or football-data.org ID) ─────────
    // Strip source prefixes ("fd:", "espn:") to get the raw external ID
    const rawExternalId = id.replace(/^(fd|espn|api-sports):/, '')
    try {
      const dbMatch = await db.match.findFirst({
        where: { externalId: rawExternalId },
        include: {
          homeTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          awayTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          events: { orderBy: { minute: 'asc' } },
        },
      }) as any

      if (dbMatch) {
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
        return NextResponse.json({ match: mapDbMatch(dbMatch, homeAnalytics, awayAnalytics), source: 'database' })
      }
    } catch (dbErr2) {
      console.error('[MatchDetail] externalId lookup failed:', dbErr2)
    }

    // ── 3. Fallback: ESPN live data ────────────────────────────────────────
    try {
      const allMatches = await fetchAllLiveScores()
      const espnMatch = allMatches.find((m) => m.id === id)

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
          players: [],
        })
        const match = {
          id: espnMatch.id,
          competition: espnMatch.competition,
          competitionCode: (espnMatch as any).competitionCode || '',
          stage: '', group: null,
          date: espnMatch.date || null,
          status: espnMatch.status, minute: espnMatch.minute, venue: espnMatch.venue,
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
        return NextResponse.json({ match, source: 'espn' })
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
    // Strip source prefixes ("fd:", "espn:", "api-sports:") for DB lookups
    const rawId = id.replace(/^(fd|espn|api-sports):/, '')
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
