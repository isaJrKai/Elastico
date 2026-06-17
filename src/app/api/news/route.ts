import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const category = searchParams.get('category') || undefined
    const search = searchParams.get('search') || undefined

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