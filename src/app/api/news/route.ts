import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchFootballNews, normalizeNDArticle } from '@/lib/newsdata'

import { rateLimit } from '@/lib/rate-limit'
/**
 * GET /api/news
 *
 * DATA FLOW: API Key -> DB (NewsArticle) -> App
 *
 * Priority chain:
 * 1. Serve from database (cached articles)
 * 2. If DB empty or ?refresh=true, fetch from Newsdata.io + ESPN, persist to DB
 *
 * ESPN news doesn't need a key but can't be easily cached (no stable IDs),
 * so ESPN serves as live fallback. Newsdata.io articles are fully persisted.
 */

const ESPN_NEWS_URLS: Record<string, string> = {
  PL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news',
  LIGA: 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/news',
  SA: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/news',
  BL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/news',
  L1: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/news',
  UCL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news',
}

// ── Category text-classification keywords ────────────────────────────────
// Used to filter persisted NewsArticles by semantic category.
// When the DB category field is generic ('sports'), we classify by title/summary content.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  match:     ['match', 'score', 'goal ', 'result', 'fixture', 'draw ', 'defeat', 'victory', 'derby', 'final', 'semi-final'],
  transfer:  ['transfer', 'signing', 'signed', 'deal', 'move to', 'joining', 'fee', 'contract', 'loan', 'released', 'free agent'],
  injury:    ['injur', 'fitness', 'sideline', 'doubt', 'rehab', 'hamstring', 'knee', 'ankle', 'muscle', 'surgery'],
  tactical:  ['tactic', 'formation', 'pressing', 'high press', 'possession', 'system', 'setup', 'approach', 'style of play', 'counter-attack'],
  rumor:     ['rumor', 'rumour', 'reported', 'interest', 'linked with', 'could join', 'set to', 'close to', 'target', 'weighing up'],
}

/**
 * Build a Prisma `where` filter for a given category.
 * Uses OR conditions on title+summary for text classification.
 * Returns null if no valid category is provided (meaning: no filter).
 */
function buildCategoryFilter(category: string): any | null {
  const keywords = CATEGORY_KEYWORDS[category]
  if (!keywords) return null
  return {
    OR: keywords.map(kw => ({
      OR: [
        { title: { contains: kw, mode: 'insensitive' } },
        { summary: { contains: kw, mode: 'insensitive' } },
      ],
    })),
  }
}

export const dynamic = 'force-dynamic'

// ── Persist Newsdata.io articles to DB ──────────────────────────────────
async function persistNewsToDb(
  query: string,
  page: number,
  limit: number
): Promise<number> {
  if (!process.env.NEWSDATA_API_KEY) return 0

  try {
    const { articles } = await fetchFootballNews(query, page, limit)
    if (articles.length === 0) return 0

    const footballArticles = articles.filter(a => {
      const text = `${a.title} ${a.description} ${a.content}`.toLowerCase()
      return /football|soccer|premier|la liga|serie a|bundesliga|ligue|champions league|europa|goal|match|transfer|player|manager|coach|club|team|fixture|score|kickoff|derby/i.test(text)
    })

    let saved = 0
    for (const a of footballArticles) {
      try {
        await db.newsArticle.upsert({
          where: { externalId: a.article_id },
          update: {
            title: a.title,
            summary: a.description?.substring(0, 200) || null,
            content: a.content || null,
            sourceName: a.source_name || 'Newsdata.io',
            sourceUrl: a.link,
            category: a.category?.[0] || 'sports',
            imageUrl: a.image_url || null,
            country: a.country?.[0] || null,
            sentiment: a.sentiment || 'neutral',
            isBreaking: a.ai_tag?.toLowerCase().includes('breaking') || false,
            publishedAt: a.pubDate ? new Date(a.pubDate) : null,
            fetchedAt: new Date(),
          },
          create: {
            externalId: a.article_id,
            title: a.title,
            summary: a.description?.substring(0, 200) || null,
            content: a.content || null,
            sourceName: a.source_name || 'Newsdata.io',
            sourceUrl: a.link,
            category: a.category?.[0] || 'sports',
            imageUrl: a.image_url || null,
            country: a.country?.[0] || null,
            sentiment: a.sentiment || 'neutral',
            isBreaking: a.ai_tag?.toLowerCase().includes('breaking') || false,
            publishedAt: a.pubDate ? new Date(a.pubDate) : null,
          },
        })
        saved++
      } catch {
        // Duplicate
      }
    }

    console.log(`[News/DB] Persisted ${saved} articles from Newsdata.io`)
    return saved
  }

  catch (err) {
    console.error('[News/DB] Persist failed:', err)
    return 0
  }
}

async function fetchESPNNewsDirect(leagueCode: string): Promise<any[]> {
  const espnUrl = ESPN_NEWS_URLS[leagueCode] || ESPN_NEWS_URLS.PL
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(espnUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 ELASTICO/1.0' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) return []
    const data = await res.json()
    return data?.articles || []
  }
  catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`news:${ip}`, 15, 60000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined
    const topic = searchParams.get('topic') || undefined
    const league = searchParams.get('league') || undefined
    const refresh = searchParams.get('refresh') === 'true'

    // ── Build category filter for PostgreSQL ─────────────────────────────
    const categoryFilter = category ? buildCategoryFilter(category) : null

    // ── Build DB where clause ─────────────────────────────────────────────
    const buildDbWhere = () => {
      const where: any = { category: 'sports' }
      if (search) where.title = { contains: search.toLowerCase() }
      if (categoryFilter) where.AND = [categoryFilter]
      return where
    }

    const dbWhere = buildDbWhere()

    // ── Serve from DATABASE first ─────────────────────────────────────────
    if (!refresh) {
      const dbArticles = await db.newsArticle.findMany({
        where: dbWhere,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      })

      const total = await db.newsArticle.count({ where: dbWhere })

      if (dbArticles.length > 0) {
        return NextResponse.json({
          news: dbArticles.map(formatDbArticle),
          source: 'database',
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }
    }

    // ── DB empty or refresh: fetch from APIs and persist ──────────────────
    // Trigger Newsdata.io persist in background
    const query = search || topic || 'football soccer premier league champions league'
    const savedCount = await persistNewsToDb(query, page, limit)

    // Re-read from DB (with category filter applied)
    const dbWhere2 = buildDbWhere()

    if (savedCount > 0) {
      const dbArticles = await db.newsArticle.findMany({
        where: dbWhere2,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      })
      const total = await db.newsArticle.count({ where: dbWhere2 })

      if (dbArticles.length > 0) {
        return NextResponse.json({
          news: dbArticles.map(formatDbArticle),
          source: 'database (refreshed from newsdata.io)',
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        })
      }
    }

    // ── Fallback: ESPN direct (no API key needed, no DB cache) ─────────────
    const leagues = league ? [league] : ['PL', 'LIGA', 'SA', 'BL', 'L1', 'UCL']
    let allEspnArticles: any[] = []
    for (const lg of leagues) {
      const articles = await fetchESPNNewsDirect(lg)
      if (articles.length > 0) {
        allEspnArticles = [...allEspnArticles, ...articles.map(a => ({ ...a, _league: lg }))]
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    allEspnArticles = allEspnArticles.filter(a => {
      const key = (a.headline || '').toLowerCase().trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (allEspnArticles.length > 0) {
      // Apply category keyword filtering on ESPN articles too
      let filtered = allEspnArticles
      if (category) {
        const keywords = CATEGORY_KEYWORDS[category]
        if (keywords) {
          filtered = allEspnArticles.filter((a: any) => {
            const text = `${a.headline || ''} ${a.description || ''}`.toLowerCase()
            return keywords.some(kw => text.includes(kw))
          })
        }
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter((a: any) => {
          const text = `${a.headline || ''} ${a.description || ''}`.toLowerCase()
          return text.includes(q)
        })
      }

      const newsItems = filtered.slice(0, limit).map((a: any, i: number) => ({
        id: `espn-${a._league || 'PL'}-${i}-${Date.now()}`,
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
        pagination: { page, limit, total: filtered.length, totalPages: 1 },
      })
    }

    return NextResponse.json({
      news: [],
      source: 'none',
      pagination: { page, limit, total: 0, totalPages: 0 },
    })
  }

  catch (error) {
    console.error('News error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatDbArticle(a: any) {
  return {
    id: a.externalId,
    title: a.title,
    summary: a.summary,
    content: a.content,
    source: a.sourceName,
    sourceUrl: a.sourceUrl,
    category: a.category,
    isBreaking: a.isBreaking,
    sentiment: a.sentiment,
    publishedAt: a.publishedAt?.toISOString() || null,
    imageUrl: a.imageUrl,
    country: a.country,
  }
}