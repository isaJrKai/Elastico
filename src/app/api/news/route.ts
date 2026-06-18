import { NextRequest, NextResponse } from 'next/server'
import { fetchFootballNews, normalizeNDArticle } from '@/lib/newsdata'

/**
 * GET /api/news
 *
 * Priority chain for real news:
 * 1. Newsdata.io (real articles from thousands of sources)
 * 2. Fallback: DB news items (if any exist)
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

    // ── Primary: Newsdata.io (real news) ──────────────────────────────────
    if (process.env.NEWSDATA_API_KEY) {
      try {
        const query = search || topic || 'football soccer premier league champions league'
        const { articles, total } = await fetchFootballNews(query, page, limit)

        if (articles.length > 0) {
          // Filter to football-relevant articles only
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

    // ── Fallback: DB news ─────────────────────────────────────────────────
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

    return NextResponse.json({
      news: newsItems,
      source: 'database',
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('News error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}