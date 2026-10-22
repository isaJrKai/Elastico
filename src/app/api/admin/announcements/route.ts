import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { z } from 'zod'

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(10_000),
  type: z.enum(['info', 'warning', 'success', 'error']).optional(),
  targetRole: z.enum(['all', 'user', 'admin', 'free', 'pro', 'elite']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
}).strict()

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    if (!auth.user || auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const announcements = await db.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ announcements })
  } catch (error) {
    console.error('Announcements GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
    }
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = AnnouncementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid announcement payload' }, { status: 400 })
    }
    const { title, content, type, targetRole, expiresAt } = parsed.data
    const expiration = expiresAt ? new Date(expiresAt) : null
    if (expiration && expiration <= new Date()) {
      return NextResponse.json({ error: 'expiresAt must be in the future' }, { status: 400 })
    }

    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        type: type || 'info',
        targetRole: targetRole || 'all',
        expiresAt: expiration,
      },
    })

    return NextResponse.json({ announcement }, { status: 201 })
  } catch (error) {
    console.error('Announcements POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}