import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchAllLiveScores, mapStatus, ESPN_LEAGUES, type ESPNMatch } from '@/lib/football-data'

/** GET /api/sync — fetch live data from ESPN and upsert into DB */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueParam = searchParams.get('league') // optional: sync single league

    const matches = leagueParam
      ? await (await import('@/lib/football-data')).fetchLeagueScores(leagueParam)
      : await fetchAllLiveScores()

    if (matches.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No matches found' })
    }

    let synced = 0
    let created = 0
    let updated = 0

    for (const m of matches) {
      // Upsert home team
      const homeTeam = await db.team.upsert({
        where: { code: m.homeTeam.abbreviation },
        update: {
          name: m.homeTeam.name,
          logo: m.homeTeam.logo,
          primaryColor: m.homeTeam.color || '#00e676',
        },
        create: {
          name: m.homeTeam.name,
          code: m.homeTeam.abbreviation,
          logo: m.homeTeam.logo,
          primaryColor: m.homeTeam.color || '#00e676',
          secondaryColor: '#ffffff',
        },
      })

      // Upsert away team
      const awayTeam = await db.team.upsert({
        where: { code: m.awayTeam.abbreviation },
        update: {
          name: m.awayTeam.name,
          logo: m.awayTeam.logo,
          primaryColor: m.awayTeam.color || '#00e676',
        },
        create: {
          name: m.awayTeam.name,
          code: m.awayTeam.abbreviation,
          logo: m.awayTeam.logo,
          primaryColor: m.awayTeam.color || '#00e676',
          secondaryColor: '#ffffff',
        },
      })

      // Map ESPN status to our status
      const status = mapStatus(m.status)

      // Upsert match using ESPN ID stored in venue field as "espn:{id}"
      const espnMatchId = `espn:${m.id}`
      const existing = await db.match.findFirst({
        where: { venue: espnMatchId },
      })

      if (existing) {
        // Update existing match
        await db.match.update({
          where: { id: existing.id },
          data: {
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            status,
            date: m.date ? new Date(m.date) : null,
            venue: m.venue || espnMatchId,
            competition: m.competition,
          },
        })
        updated++
      } else {
        // Create new match
        await db.match.create({
          data: {
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            status,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            date: m.date ? new Date(m.date) : null,
            venue: espnMatchId,
            competition: m.competition,
            stage: m.competition,
          },
        })
        created++
      }
      synced++
    }

    return NextResponse.json({
      success: true,
      synced,
      created,
      updated,
      leagues: ESPN_LEAGUES.map(l => l.name),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[SYNC] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}