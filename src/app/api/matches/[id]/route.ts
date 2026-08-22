import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLiveScores } from '@/lib/football-data'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

function mapDbMatch(m: any, teamAnalytics?: Map<string, any> | null) {
  const teamMap = (t: any, analytics?: any) => ({
    id: t.id, name: t.name, code: t.code || '', logo: t.logo,
    primaryColor: t.primaryColor, secondaryColor: t.secondaryColor,
    eloRating: t.eloRating ?? 1500, form: '',
    wins: t.wins ?? 0, draws: t.draws ?? 0, losses: t.losses ?? 0,
    goalsFor: t.goalsFor ?? 0, goalsAgainst: t.goalsAgainst ?? 0,
    xgPerGame: analytics?.xgPerGame ?? null,
    xgaPerGame: analytics?.xgaPerGame ?? null,
    xgSource: analytics?.xgSource ?? null,
    possession: 50, passAccuracy: 0, pressIntensity: 0,
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
    homeXg: m.homeXg ?? 0,
    awayXg: m.awayXg ?? 0,
    possessionHome: m.possessionHome ?? 50,
    possessionAway: m.possessionAway ?? 50,
    shotsHome: m.shotsHome ?? 0,
    shotsAway: m.shotsAway ?? 0,
    shotsOnTargetHome: m.shotsOnTargetHome ?? 0,
    shotsOnTargetAway: m.shotsOnTargetAway ?? 0,
    cornersHome: m.cornersHome ?? 0,
    cornersAway: m.cornersAway ?? 0,
    homeWinProb: null, drawProb: null, awayWinProb: null,
    homeEloBefore: m.homeTeam?.eloRating ?? 1500,
    awayEloBefore: m.awayTeam?.eloRating ?? 1500,
    isSimulated: false,
    homeTeam: teamMap(m.homeTeam),
    awayTeam: teamMap(m.awayTeam),
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
        return NextResponse.json({ match: mapDbMatch(dbMatch), source: 'database' })
      }
    } catch (dbErr) {
      console.error('[MatchDetail] DB lookup failed, trying externalId:', dbErr)
    }

    // ── 2. Try by externalId (API-Sports ID) ───────────────────────────────
    try {
      const dbMatch = await db.match.findFirst({
        where: { externalId: id },
        include: {
          homeTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          awayTeam: { include: { players: { orderBy: { goals: 'desc' }, take: 25 } } },
          events: { orderBy: { minute: 'asc' } },
        },
      }) as any

      if (dbMatch) {
        return NextResponse.json({ match: mapDbMatch(dbMatch), source: 'database' })
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
          xgPerGame: 0, xgaPerGame: 0, possession: 50, passAccuracy: 0, pressIntensity: 0,
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
          homeXg: 0, awayXg: 0,
          possessionHome: 50, possessionAway: 50,
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
    const { choice } = await req.json()

    if (!choice || !['home', 'draw', 'away'].includes(choice)) {
      return NextResponse.json({ error: 'Choice must be home, draw, or away' }, { status: 400 })
    }

    // Try to find team names from DB first, then ESPN
    let homeTeamName = 'Home'
    let awayTeamName = 'Away'

    try {
      const dbMatch = await db.match.findUnique({ where: { id }, include: { homeTeam: true, awayTeam: true } }) as any
      if (dbMatch) {
        homeTeamName = dbMatch.homeTeam.name
        awayTeamName = dbMatch.awayTeam.name
      } else {
        const byExtId = await db.match.findFirst({ where: { externalId: id }, include: { homeTeam: true, awayTeam: true } }) as any
        if (byExtId) { homeTeamName = byExtId.homeTeam.name; awayTeamName = byExtId.awayTeam.name }
      }
    } catch {}

    if (homeTeamName === 'Home') {
      try {
        const allMatches = await fetchAllLiveScores()
        const espnMatch = allMatches.find((m) => m.id === id)
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
