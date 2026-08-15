import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const bookmarks = await (db as any).bookmark.findMany({
      where: { userId: user.id },
      include: {
        match: {
          include: {
            homeTeam: { select: { id: true, name: true, code: true, primaryColor: true } },
            awayTeam: { select: { id: true, name: true, code: true, primaryColor: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ bookmarks })
  } catch (error) {
    console.error('Bookmarks fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const { matchId, note } = await req.json()
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const existing = await db.bookmark.findUnique({
      where: { userId_matchId: { userId: user.id, matchId } },
    })

    if (existing) {
      return NextResponse.json({ error: 'Already bookmarked' }, { status: 409 })
    }

    const bookmark = await (db as any).bookmark.create({
      data: { userId: user.id, matchId, note: note || null },
      include: { match: true },
    })

    return NextResponse.json({ bookmark }, { status: 201 })
  } catch (error) {
    console.error('Bookmark create error:', error)
    return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth

    const url = req.nextUrl.searchParams
    const matchId = url.get('matchId')

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const deleted = await db.bookmark.deleteMany({
      where: { userId: user.id, matchId },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bookmark delete error:', error)
    return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 })
  }
}