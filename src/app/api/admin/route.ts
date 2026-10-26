import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth instanceof Response) return auth
  const { user } = auth
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return { user, req: auth.req }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalUsers,
      activeToday,
      proCount,
      eliteCount,
      totalPredictions,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { lastLoginAt: { gte: today } } }),
      db.user.count({ where: { plan: 'pro', isActive: true } }),
      db.user.count({ where: { plan: 'elite', isActive: true } }),
      db.prediction.count(),
    ])

    // Data for matches now comes from ESPN — return 0
    // Data for API logs now comes from serverless provider logs — return 0
    const totalMatches = 0
    const errorRate = 0
    const totalApiCalls24h = 0

    // Revenue estimate: pro=$9.99/mo, elite=$24.99/mo
    const revenueEstimate = proCount * 9.99 + eliteCount * 24.99

    return NextResponse.json({
      dashboard: {
        totalUsers,
        activeToday,
        proCount,
        eliteCount,
        totalMatches,
        totalPredictions,
        revenueEstimate: Math.round(revenueEstimate * 100) / 100,
        errorRate,
        totalApiCalls24h,
      },
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof Response) return auth

    const body = await req.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (action === 'clearEvents') {
      // Match events no longer exist — data comes from ESPN
      return NextResponse.json({ success: true, message: 'Match events are now handled by ESPN live data. No local events to clear.' })
    }

    if (action === 'maintenance') {
      const current = await db.systemSetting.findUnique({ where: { key: 'maintenance_mode' } })
      const enabled = current?.value !== 'true'
      await db.systemSetting.upsert({
        where: { key: 'maintenance_mode' },
        update: { value: String(enabled), type: 'boolean' },
        create: { key: 'maintenance_mode', value: String(enabled), type: 'boolean' },
      })
      return NextResponse.json({
        success: true,
        enabled,
        message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      })
    }

    if (action === 'notifySegment') {
      const { message, title, segment } = body
      if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
        return NextResponse.json({ error: 'A notification title and message are required' }, { status: 400 })
      }
      const validSegments = ['all', 'free', 'pro', 'elite', 'inactive']
      if (typeof segment !== 'string' || !validSegments.includes(segment)) {
        return NextResponse.json({ error: 'segment must be all, free, pro, elite, or inactive' }, { status: 400 })
      }
      const where: any = { isActive: true }
      if (segment === 'free' || segment === 'pro' || segment === 'elite') where.plan = segment
      if (segment === 'inactive') {
        const inactiveSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        where.OR = [{ lastLoginAt: null }, { lastLoginAt: { lt: inactiveSince } }]
      }
      const recipients = await db.user.findMany({ where, select: { id: true } })
      if (recipients.length > 0) {
        await db.notification.createMany({
          data: recipients.map(recipient => ({
            userId: recipient.id,
            type: 'system',
            title: title.trim(),
            message: message.trim(),
          })),
        })
      }
      return NextResponse.json({ success: true, notifiedUsers: recipients.length, message: `In-app notification sent to ${recipients.length} users` })
    }

    if (action === 'broadcast') {
      const { message, title, type } = body
      if (!message) {
        return NextResponse.json({ error: 'Message is required for broadcast' }, { status: 400 })
      }

      // Create announcement
      await db.announcement.create({
        data: {
          title: title || 'System Broadcast',
          content: message,
          type: type || 'info',
          targetRole: 'all',
        },
      })

      // Notify all active users
      const activeUsers = await db.user.findMany({ where: { isActive: true }, select: { id: true } })
      const notifications = activeUsers.map((u) => ({
        userId: u.id,
        type: 'system' as const,
        title: title || 'System Broadcast',
        message,
      }))

      if (notifications.length > 0) {
        await db.notification.createMany({ data: notifications })
      }

      return NextResponse.json({ success: true, notifiedUsers: activeUsers.length })
    }

    if (action === 'sync') {
      return NextResponse.json({
        error: 'No background sync job is configured. Match data is fetched live from the provider.',
      }, { status: 501 })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}