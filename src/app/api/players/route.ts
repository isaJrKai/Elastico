import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams
    const teamId = url.get('teamId')
    const position = url.get('position')
    const search = url.get('search')
    const sortBy = url.get('sortBy') || 'rating'
    const limit = Math.min(parseInt(url.get('limit') || '50'), 200)
    const offset = parseInt(url.get('offset') || '0')

    const where: Record<string, unknown> = {}
    if (teamId) where.teamId = teamId
    if (position) where.position = position
    if (search) where.name = { contains: search }

    const orderBy: Record<string, string> = {}
    if (sortBy === 'name') orderBy.name = 'asc'
    else if (sortBy === 'goals') orderBy.goals = 'desc'
    else if (sortBy === 'assists') orderBy.assists = 'desc'
    else if (sortBy === 'age') orderBy.age = 'asc'
    else if (sortBy === 'marketValue') orderBy.marketValue = 'desc'
    else orderBy.rating = 'desc'

    const [players, total] = await Promise.all([
      db.player.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: { team: { select: { id: true, name: true, code: true, primaryColor: true } } },
      }),
      db.player.count({ where }),
    ])

    return NextResponse.json({
      players,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    console.error('Players fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
}