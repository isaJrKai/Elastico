import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const categories = new Set(['general', 'transfer', 'injury', 'tactical', 'match', 'rumor'])
const sentiments = new Set(['positive', 'negative', 'neutral'])

async function requireAdmin(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth instanceof Response) return auth
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  return auth
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateArticle(body: unknown) {
  if (!isRecord(body)) return { error: 'Request body must be a JSON object' }
  const { title, summary, content, sourceUrl, category, sentiment, isBreaking } = body
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
    return { error: 'title is required and must be at most 200 characters' }
  }
  if (summary !== undefined && summary !== null && (typeof summary !== 'string' || summary.length > 500)) {
    return { error: 'summary must be at most 500 characters' }
  }
  if (content !== undefined && content !== null && (typeof content !== 'string' || content.length > 10000)) {
    return { error: 'content must be at most 10,000 characters' }
  }
  if (typeof sourceUrl !== 'string' || sourceUrl.length > 2048) {
    return { error: 'A canonical source URL is required' }
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(sourceUrl)
  } catch {
    return { error: 'sourceUrl must be an absolute HTTP or HTTPS URL' }
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return { error: 'sourceUrl must use HTTP or HTTPS' }
  }
  if (typeof category !== 'string' || !categories.has(category)) {
    return { error: 'Unsupported news category' }
  }
  if (typeof sentiment !== 'string' || !sentiments.has(sentiment)) {
    return { error: 'Unsupported sentiment value' }
  }
  if (typeof isBreaking !== 'boolean') {
    return { error: 'isBreaking must be a boolean' }
  }
  return {
    value: {
      title: title.trim(),
      summary: typeof summary === 'string' ? summary.trim() || null : null,
      content: typeof content === 'string' ? content.trim() || null : null,
      sourceUrl: parsedUrl.toString(),
      category,
      sentiment,
      isBreaking,
    },
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth
    const limit = rateLimit(`admin-news-read:${auth.user.id}`, 60, 60_000)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const articles = await db.newsArticle.findMany({
      where: { sourceName: 'ELASTICO Editorial' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ articles })
  } catch (error) {
    console.error('[AdminNews] List failed:', error)
    return NextResponse.json({ error: 'Failed to load editorial articles' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth
    const limit = rateLimit(`admin-news-write:${auth.user.id}`, 30, 60_000)
    if (!limit.allowed) return NextResponse.json({ error: 'Too many editorial changes' }, { status: 429 })
    const body: unknown = await req.json().catch(() => null)
    const validated = validateArticle(body)
    if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400)
    const article = await db.newsArticle.create({
      data: {
        externalId: `editorial-${randomUUID()}`,
        title: validated.value.title,
        summary: validated.value.summary,
        content: validated.value.content,
        sourceName: 'ELASTICO Editorial',
        sourceUrl: validated.value.sourceUrl,
        category: validated.value.category,
        sentiment: validated.value.sentiment,
        isBreaking: validated.value.isBreaking,
        language: 'en',
        publishedAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, article }, { status: 201 })
  } catch (error) {
    console.error('[AdminNews] Create failed:', error)
    return NextResponse.json({ error: 'Failed to publish article' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string' || !body.id.trim()) {
      return NextResponse.json({ error: 'Article id is required' }, { status: 400 })
    }
    const validated = validateArticle(body)
    if ('error' in validated) return NextResponse.json({ error: validated.error }, { status: 400)
    const existing = await db.newsArticle.findFirst({
      where: { id: body.id, sourceName: 'ELASTICO Editorial' },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'Editorial article not found' }, { status: 404)
    const article = await db.newsArticle.update({
      where: { id: existing.id },
      data: {
        title: validated.value.title,
        summary: validated.value.summary,
        content: validated.value.content,
        sourceUrl: validated.value.sourceUrl,
        category: validated.value.category,
        sentiment: validated.value.sentiment,
        isBreaking: validated.value.isBreaking,
      },
    })
    return NextResponse.json({ success: true, article })
  } catch (error) {
    console.error('[AdminNews] Update failed:', error)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth
    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.id !== 'string' || !body.id.trim()) {
      return NextResponse.json({ error: 'Article id is required' }, { status: 400 })
    }
    const existing = await db.newsArticle.findFirst({
      where: { id: body.id, sourceName: 'ELASTICO Editorial' },
      select: { id: true },
    })
    if (!existing) return NextResponse.json({ error: 'Editorial article not found' }, { status: 404)
    await db.newsArticle.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, message: 'Article deleted' })
  } catch (error) {
    console.error('[AdminNews] Delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
