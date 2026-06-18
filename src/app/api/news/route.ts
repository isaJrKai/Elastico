import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/news
 * 
 * Now prioritizes real data sources:
 * 1. If `source=football-data`, fetches top scorers and competition data 
 *    from football-data.org and formats as news items
 * 2. Default: returns DB news items (seeded or user-created)
 * 3. If DB is empty and no football-data key, returns empty array (no mock)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined
    const source = searchParams.get('source') || undefined

    // ── Football-Data.org as news source ──────────────────────────────────
    if (source === 'football-data' && process.env.FOOTBALL_DATA_API_KEY) {
      try {
        const { fetchScorers, fetchCompetitions } = await import('@/lib/football-data-org')
        
        const [scorersPL, scorersSA, competitions] = await Promise.allSettled([
          fetchScorers('PL', 5),
          fetchScorers('SA', 5),
          fetchCompetitions(),
        ])

        const newsItems: any[] = []

        // Top scorer news
        for (const result of [scorersPL, scorersSA]) {
          if (result.status === 'fulfilled' && result.value.length > 0) {
            const top = result.value[0]
            const comp = result === scorersPL ? 'Premier League' : 'Serie A'
            newsItems.push({
              id: `scorer-${comp}`,
              title: `${top.player?.name || 'Unknown'} leads ${comp} scoring with ${top.goals || 0} goals`,
              summary: `Top scorer in ${comp} this season with ${top.goals || 0} goals in ${top.playedMatches || '?'} appearances. ${top.assists ? `${top.assists} assists.` : ''}`,
              source: 'football-data.org',
              category: 'performance',
              isBreaking: false,
              sentiment: 'positive',
              publishedAt: new Date().toISOString(),
            })
          }
        }

        // Competition status news
        if (competitions.status === 'fulfilled' && competitions.value.length > 0) {
          for (const comp of competitions.value.slice(0, 8)) {
            const season = comp.currentSeason
            if (season) {
              newsItems.push({
                id: `comp-${comp.code}`,
                title: `${comp.name}: Matchday ${season.currentMatchday || 'TBD'}`,
                summary: season.winner
                  ? `${comp.name} ${season.startDate.split('-')[0]}/${season.endDate.split('-')[0]} season completed. Winner: ${season.winner}.`
                  : `${comp.name} ${season.startDate.split('-')[0]}/${season.endDate.split('-')[0]} season in progress. Current matchday: ${season.currentMatchday || 'TBD'}.`,
                source: 'football-data.org',
                category: 'tournament',
                isBreaking: false,
                sentiment: 'neutral',
                publishedAt: new Date().toISOString(),
              })
            }
          }
        }

        return NextResponse.json({
          news: newsItems,
          source: 'football-data.org',
          pagination: { page: 1, limit: 20, total: newsItems.length, totalPages: 1 },
        })
      } catch (err) {
        console.error('[News] football-data.org fetch failed:', err)
        // Fall through to DB
      }
    }

    // ── DB News (default) ────────────────────────────────────────────────
    const where: Record<string, unknown> = {}
    if (category) where.category = category
    if (search) where.title = { contains: search, mode: 'insensitive' }

    const [newsItems, total] = await Promise.all([
      db.newsItem.findMany({
        where,
        orderBy: [{ isBreaking: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.newsItem.count({ where }),
    ])

    return NextResponse.json({
      news: newsItems,
      source: 'database',
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('News error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}