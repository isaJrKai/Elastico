import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toPublicAnnouncement } from '@/lib/public-announcements'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const announcements = await db.announcement.findMany({
      where: {
        isActive: true,
        targetRole: 'all',
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json(announcements.map(toPublicAnnouncement), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Public announcements GET error:', error)
    return NextResponse.json({ error: 'Announcements unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
