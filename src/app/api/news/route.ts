import { NextRequest, NextResponse } from 'next/server'
import { fetchFootballNews, normalizeNDArticle } from '@/lib/newsdata'

/**
 * GET /api/news
 *
 * Priority chain for real news:
 * 1. ESPN league news (direct fetch, no API key needed)
 * 2. Newsdata.io (if API key configured)
 * 3. Fallback: DB news items (if any exist)
 */

const ESPN_NEWS_URLS: Record<string, string> = {
  PL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news',
  LIGA: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/news',
  SA: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news',
  BL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/news',
  L1: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/news',
  UCL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news',
}

export const dynamic = 'force-dynamic'

async function fetchESPNNewsDirect(leagueCode: string): Promise<any[]> {
  const espnUrl = ESPN_NEWS_URLS[leagueCode] || ESPN_NEWS_URLS.PL
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout for edge
    const res = await fetch(espnUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 ELASTICO/1.0' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      console.error(`[News] ESPN direct fetch ${res.status} from ${espnUrl}`)
      return []
    }
    const data = await res.json()
    const articles = data?.articles || []
    console.log(`[News] ESPN direct got ${articles.length} articles for ${leagueCode}`)
    return articles
  } catch (err) {
    console.error(`[News] ESPN direct fetch error for ${leagueCode}:`, err)
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || undefined
    const topic = searchParams.get('topic') || undefined
    const league = searchParams.get('league') || undefined

    // ── Primary: ESPN news from multiple leagues (direct fetch, no API key needed) ─
    try {
      const leagues = league ? [league] : ['PL', 'LIGA', 'SA', 'BL', 'L1', 'UCL']
      let allEspnArticles: any[] = []
      for (const lg of leagues) {
        const articles = await fetchESPNNewsDirect(lg)
        if (articles.length > 0) {
          allEspnArticles = [...allEspnArticles, ...articles.map(a => ({ ...a, _league: lg }))]
        }
      }
      // Deduplicate by headline
      const seen = new Set<string>()
      allEspnArticles = allEspnArticles.filter(a => {
        const key = (a.headline || '').toLowerCase().trim()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })

      if (allEspnArticles.length > 0) {
        const newsItems = allEspnArticles.slice(0, limit).map((a: any, i: number) => ({
          id: `espn-${a._league || league || 'PL'}-${i}-${Date.now()}`,
          title: a.headline || '',
          summary: a.description || '',
          content: null,
          source: a.source?.name || 'ESPN',
          sourceUrl: a.links?.web?.href || a.links?.mobile?.href || '',
          category: a.type || 'sports',
          isBreaking: false,
          sentiment: 'neutral',
          publishedAt: a.published || a.date || new Date().toISOString(),
          imageUrl: a.images?.[0]?.url || a.image?.url || '',
        }))

        return NextResponse.json({
          news: newsItems,
          source: `espn:${leagues.join(',')}`,
          pagination: { page, limit, total: newsItems.length, totalPages: 1 },
        })
      }
    } catch (err) {
      console.error('[News] ESPN news fetch failed:', err)
    }

    // ── Secondary: Newsdata.io (if API key configured) ────────────────────
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