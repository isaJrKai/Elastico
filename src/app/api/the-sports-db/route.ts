import { NextRequest, NextResponse } from 'next/server'
import {
  fetchTeams, fetchTeamDetails, searchTeam, fetchLeaguesByCountry,
  fetchPlayersByTeam, searchPlayer, fetchPlayerDetails,
  fetchLastEvents, fetchNextEvents, fetchStandings,
  fetchLeagueEvents,
  normalizeTSDEvent, normalizeTSDTableEntry, TSD_LEAGUES,
} from '@/lib/the-sports-db'

/**
 * GET /api/the-sports-db
 * Unified endpoint for TheSportsDB data
 *
 * Query params:
 *   action=teams&league=PL           — All teams in a league (by code)
 *   action=team&id=133602            — Team details by TSD ID
 *   action=search-team&q=Arsenal    — Search teams by name
 *   action=players&team=133602      — All players for a team
 *   action=search-player&q=Messi    — Search players by name
 *   action=player&id=34147359       — Player details by TSD ID
 *   action=last-events&team=133602  — Last 5 results for a team
 *   action=next-events&team=133602  — Next 5 fixtures for a team
 *   action=standings&league=PL      — League table
 *   action=leagues&country=England  — All soccer leagues for a country
 *   action=list-leagues             — List supported ELASTICO leagues
 *   action=league-events&league=PL  — Past events for a league
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list-leagues'

    if (!process.env.THE_SPORTS_DB_KEY) {
      return NextResponse.json({
        success: false,
        error: 'THE_SPORTS_DB_KEY not configured',
        hint: 'Add THE_SPORTS_DB_KEY=123 to Vercel > Settings > Environment Variables',
      }, { status: 503 })
    }

    switch (action) {
      // ── Teams ───────────────────────────────────────────────────────────
      case 'teams': {
        const league = searchParams.get('league') || 'PL'
        const teams = await fetchTeams(league)
        return NextResponse.json({
          success: true,
          action,
          league,
          count: teams.length,
          data: teams.map(t => ({
            id: t.idTeam,
            name: t.strTeam,
            shortName: t.strTeamShort,
            badge: t.strBadge,
            logo: t.strLogo,
            banner: t.strBanner,
            kit: t.strKit,
            stadium: t.strStadium,
            capacity: t.intStadiumCapacity,
            formedYear: t.intFormedYear,
            country: t.strCountry,
            league: t.strLeague,
            website: t.strWebsite,
            source: 'TheSportsDB',
          })),
        })
      }

      case 'team': {
        const id = searchParams.get('id')
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing ?id= param' }, { status: 400 })
        }
        const team = await fetchTeamDetails(id)
        if (!team) {
          return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          action,
          data: {
            id: team.idTeam,
            name: team.strTeam,
            shortName: team.strTeamShort,
            alternate: team.strAlternate,
            badge: team.strBadge,
            logo: team.strLogo,
            banner: team.strBanner,
            kit: team.strKit,
            equipment: team.strEquipment,
            stadium: team.strStadium,
            stadiumThumb: team.strStadiumThumb,
            stadiumDescription: team.strStadiumDescription,
            capacity: team.intStadiumCapacity,
            location: team.strStadiumLocation,
            formedYear: team.intFormedYear,
            country: team.strCountry,
            league: team.strLeague,
            description: team.strDescriptionEN,
            website: team.strWebsite,
            facebook: team.strFacebook,
            instagram: team.strInstagram,
            twitter: team.strTwitter,
            youtube: team.strYoutube,
            wikipedia: team.strWikipedia,
            source: 'TheSportsDB',
          },
        })
      }

      case 'search-team': {
        const q = searchParams.get('q')
        if (!q) {
          return NextResponse.json({ success: false, error: 'Missing ?q= param' }, { status: 400 })
        }
        const teams = await searchTeam(q)
        return NextResponse.json({
          success: true,
          action,
          query: q,
          count: teams.length,
          data: teams.map(t => ({
            id: t.idTeam,
            name: t.strTeam,
            shortName: t.strTeamShort,
            badge: t.strBadge,
            logo: t.strLogo,
            sport: t.strSport,
            league: t.strLeague,
            country: t.strCountry,
            source: 'TheSportsDB',
          })),
        })
      }

      // ── Players ─────────────────────────────────────────────────────────
      case 'players': {
        const teamId = searchParams.get('team')
        if (!teamId) {
          return NextResponse.json({ success: false, error: 'Missing ?team= param' }, { status: 400 })
        }
        const players = await fetchPlayersByTeam(teamId)
        return NextResponse.json({
          success: true,
          action,
          teamId,
          count: players.length,
          data: players.map(p => ({
            id: p.idPlayer,
            name: p.strPlayer,
            nationality: p.strNationality,
            position: p.strPosition,
            dateBorn: p.dateBorn,
            height: p.strHeight,
            weight: p.strWeight,
            thumb: p.strThumb,
            cutout: p.strCutout,
            team: p.strTeam,
            teamBadge: p.strTeamBadge,
            rating: p.intSoccerRating,
            wage: p.strWage,
            description: p.strDescriptionEN,
            source: 'TheSportsDB',
          })),
        })
      }

      case 'search-player': {
        const q = searchParams.get('q')
        if (!q) {
          return NextResponse.json({ success: false, error: 'Missing ?q= param' }, { status: 400 })
        }
        const players = await searchPlayer(q)
        return NextResponse.json({
          success: true,
          action,
          query: q,
          count: players.length,
          data: players.map(p => ({
            id: p.idPlayer,
            name: p.strPlayer,
            nationality: p.strNationality,
            position: p.strPosition,
            dateBorn: p.dateBorn,
            team: p.strTeam,
            teamBadge: p.strTeamBadge,
            thumb: p.strThumb,
            rating: p.intSoccerRating,
            source: 'TheSportsDB',
          })),
        })
      }

      case 'player': {
        const id = searchParams.get('id')
        if (!id) {
          return NextResponse.json({ success: false, error: 'Missing ?id= param' }, { status: 400 })
        }
        const player = await fetchPlayerDetails(id)
        if (!player) {
          return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          action,
          data: {
            id: player.idPlayer,
            name: player.strPlayer,
            nationality: player.strNationality,
            position: player.strPosition,
            dateBorn: player.dateBorn,
            birthLocation: player.strBirthLocation,
            dateSigned: player.dateSigned,
            signing: player.strSigning,
            height: player.strHeight,
            weight: player.strWeight,
            rating: player.intSoccerRating,
            wage: player.strWage,
            thumb: player.strThumb,
            cutout: player.strCutout,
            banner: player.strBanner,
            team: player.strTeam,
            teamBadge: player.strTeamBadge,
            gender: player.strGender,
            sport: player.strSport,
            description: player.strDescriptionEN,
            facebook: player.strFacebook,
            instagram: player.strInstagram,
            twitter: player.strTwitter,
            website: player.strWebsite,
            youtube: player.strYoutube,
            wikipedia: player.strWikipedia,
            source: 'TheSportsDB',
          },
        })
      }

      // ── Events (Results & Fixtures) ─────────────────────────────────────
      case 'last-events': {
        const teamId = searchParams.get('team')
        if (!teamId) {
          return NextResponse.json({ success: false, error: 'Missing ?team= param' }, { status: 400 })
        }
        const events = await fetchLastEvents(teamId)
        return NextResponse.json({
          success: true,
          action,
          teamId,
          count: events.length,
          data: events.map(normalizeTSDEvent),
        })
      }

      case 'next-events': {
        const teamId = searchParams.get('team')
        if (!teamId) {
          return NextResponse.json({ success: false, error: 'Missing ?team= param' }, { status: 400 })
        }
        const events = await fetchNextEvents(teamId)
        return NextResponse.json({
          success: true,
          action,
          teamId,
          count: events.length,
          data: events.map(normalizeTSDEvent),
        })
      }

      case 'league-events': {
        const league = searchParams.get('league') || 'PL'
        const round = searchParams.get('round') || undefined
        const season = searchParams.get('season') || undefined
        const leagueObj = TSD_LEAGUES.find(l => l.code.toUpperCase() === league.toUpperCase())
        if (!leagueObj) {
          return NextResponse.json({ success: false, error: `Unknown league code: ${league}` }, { status: 400 })
        }
        const events = await fetchLeagueEvents(String(leagueObj.id), season, round)
        return NextResponse.json({
          success: true,
          action,
          league: leagueObj.name,
          count: events.length,
          data: events.map(normalizeTSDEvent),
        })
      }

      // ── Standings ───────────────────────────────────────────────────────
      case 'standings': {
        const league = searchParams.get('league') || 'PL'
        const season = searchParams.get('season') || undefined
        const table = await fetchStandings(league, season)
        return NextResponse.json({
          success: true,
          action,
          league,
          count: table.length,
          data: table
            .map((entry, i) => ({
              ...normalizeTSDTableEntry(entry),
              position: i + 1,
            })),
        })
      }

      // ── Leagues ─────────────────────────────────────────────────────────
      case 'leagues': {
        const country = searchParams.get('country') || 'England'
        const leagues = await fetchLeaguesByCountry(country)
        return NextResponse.json({
          success: true,
          action,
          country,
          count: leagues.length,
          data: leagues.map(l => ({
            id: l.idLeague,
            name: l.strLeague,
            alternate: l.strLeagueAlternate,
            sport: l.strSport,
            country: l.strCountry,
            season: l.strCurrentSeason,
            badge: l.strBadge,
            banner: l.strBanner,
            description: l.strDescriptionEN,
            website: l.strWebsite,
            source: 'TheSportsDB',
          })),
        })
      }

      case 'list-leagues':
      default: {
        return NextResponse.json({
          success: true,
          action: 'list-leagues',
          count: TSD_LEAGUES.length,
          data: TSD_LEAGUES.map(l => ({
            id: l.id,
            code: l.code,
            name: l.name,
          })),
        })
      }
    }
  } catch (error) {
    console.error('[TheSportsDB] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}