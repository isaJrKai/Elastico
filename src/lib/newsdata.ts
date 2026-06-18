/**
 * ELASTICO — Newsdata.io Service
 *
 * Real football/soccer news from thousands of sources worldwide.
 * Free tier: 200 requests/day.
 */

const BASE = 'https://newsdata.io/api/1/news'

function apiKey(): string {
  return process.env.NEWSDATA_API_KEY || ''
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NDNewsArticle {
  article_id: string
  title: string
  link: string
  keywords: string | null
  creator: string | null
  video_url: string | null
  description: string
  content: string
  pubDate: string
  image_url: string | null
  source_id: string
  source_name: string
  source_url: string
  source_icon: string | null
  language: string
  country: string[]
  category: string[]
  sentiment: string | null
  sentiment_stats: string | null
  ai_tag: string | null
}

interface NDResponse {
  status: string
  totalResults: number
  results: NDNewsArticle[]
  nextPage: string | null
}

// ── API Calls ──────────────────────────────────────────────────────────────────

/** Fetch football/soccer news */
export async function fetchFootballNews(
  query?: string,
  page?: number,
  limit = 20
): Promise<{ articles: NDNewsArticle[]; total: number; nextPage: string | null }> {
  const key = apiKey()
  if (!key) return { articles: [], total: 0, nextPage: null }

  const params = new URLSearchParams({
    apikey: key,
    category: 'sports',
    language: 'en',
    size: String(limit),
  })

  if (query) params.set('q', query)
  if (page) params.set('page', String(page))

  try {
    const res = await fetch(`${BASE}?${params}`, {
      next: { revalidate: 600 }, // cache 10 min
    })
    if (!res.ok) {
      console.error(`[Newsdata.io] Error ${res.status}`)
      return { articles: [], total: 0, nextPage: null }
    }
    const data: NDResponse = await res.json()
    return {
      articles: data.results || [],
      total: data.totalResults || 0,
      nextPage: data.nextPage,
    }
  } catch (err) {
    console.error('[Newsdata.io] Fetch failed:', err)
    return { articles: [], total: 0, nextPage: null }
  }
}

/** Fetch news filtered by specific football topics */
export async function fetchFootballNewsByTopic(
  topic: 'transfers' | 'injuries' | 'match-report' | 'premier-league' | 'champions-league' | 'general',
  limit = 10
): Promise<NDNewsArticle[]> {
  const topicQueries: Record<string, string> = {
    transfers: 'football transfer window',
    injuries: 'football injury squad',
    'match-report': 'football match result goal',
    'premier-league': 'Premier League',
    'champions-league': 'Champions League UEFA',
    general: 'football soccer',
  }

  const { articles } = await fetchFootballNews(topicQueries[topic] || 'football', 1, limit)
  return articles
}

// ── Mapping ────────────────────────────────────────────────────────────────────

/** Convert Newsdata article to ELASTICO news format */
export function normalizeNDArticle(a: NDNewsArticle) {
  return {
    id: a.article_id,
    title: a.title,
    summary: a.description?.substring(0, 200) || null,
    content: a.content || null,
    source: a.source_name || 'Newsdata.io',
    sourceUrl: a.link,
    category: a.category?.[0] || 'sports',
    isBreaking: a.ai_tag?.toLowerCase().includes('breaking') || false,
    sentiment: a.sentiment || 'neutral',
    publishedAt: a.pubDate,
    imageUrl: a.image_url || null,
    country: a.country?.[0] || null,
  }
}