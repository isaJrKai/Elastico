import { NextRequest, NextResponse } from 'next/server'
import { fetchFootballNews, normalizeNDArticle } from '@/lib/newsdata'

/**
 * GET /api/news
 *
 * Priority chain for real news:
 * 1. Newsdata.io (real articles from thousands of sources)
 * 2. ESPN league news (from /api/live?action=news)
 * 3. Fallback: DB news items (if any exist)
 * No mock data — returns empty array if no sources available.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || undefined
    const topic = searchParams.get('topic') || undefined
    const league = searchParams.get('league') || undefined

    // ── Primary: ESPN league news (no API key needed — always available) ──
    try {
      const { fetchLeagueNews } = await import('@/lib/football-data')
      const newsLeague = league || 'PL'
      const espnNews = await fetchLeagueNews(newsLeague)

      if (espnNews.length > 0) {
        const newsItems = espnNews.map((n, i) => ({
          id: `espn-${newsLeague}-${i}`,
          title: n.headline,
          summary: n.description,
          content: null,
          source: n.source || 'ESPN',
          sourceUrl: n.link,
          category: n.type || 'sports',
          isBreaking: false,
          sentiment: 'neutral',
          publishedAt: n.publishedAt,
          imageUrl: n.imageUrl,
        }))

        return NextResponse.json({
          news: newsItems,
          source: `espn:${newsLeague}`,
          pagination: { page, limit, total: newsItems.length, totalPages: 1 },
        })
      }
    } catch (err) {
      console.error('[News] ESPN news fetch failed:', err)
    }

    // ── Secondary: Newsdata.io (real news from thousands of sources) ──────
    if (process.env.NEWSDATA_API_KEY) {
      try {
        const query = search || topic || 'football soccer premier league champions league'
        const { articles, total } = await fetchFootballNews(query, page, limit)

        if (articles.length > 0) {
          const footballArticles = articles.filter(a => {
            const text = `${a.title} ${a.description} ${a.content}`.toLowerCase()
            return /football|soccer|premier|la liga|serie a|bundesliga|ligue|champions league|europa|goal|match|transfer|player|manager|coach|club|team|fixture|score|kickoff|derby/i.test(text)
          })

          const newsItems = footballArticles.map(normalizeNDArticle)
          return NextResponse.json({
            news: newsItems,
            source: 'newsdata.io',
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          })
        }
      } catch (err) {
        console.error('[News] Newsdata.io fetch failed:', err)
      }
    }

    // ── Tertiary: DB news (seeded / user-created) ─────────────────────────
    try {
      const { db } = await import('@/lib/db')
      const category = searchParams.get('category') || undefined

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

      if (newsItems.length > 0) {
        return NextResponse.json({
          news: newsItems,
          source: 'database',
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }
    } catch (err) {
      console.error('[News] DB news fetch failed:', err)
    }

    // ── Nothing available ─────────────────────────────────────────────────
    return NextResponse.json({
      news: [],
      source: 'none',
      pagination: { page, limit, total: 0, totalPages: 0 },
    })
  } catch (error) {
    console.error('News error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}