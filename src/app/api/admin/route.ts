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
      totalMatches,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { lastLoginAt: { gte: today } } }),
      db.user.count({ where: { plan: 'pro', isActive: true } }),
      db.user.count({ where: { plan: 'elite', isActive: true } }),
      db.prediction.count(),
      db.match.count(),
    ])

    // These operational and billing metrics are not currently instrumented.
    // Do not turn missing data into zero or estimate revenue from plan labels.
    const errorRate: number | null = null
    const totalApiCalls24h: number | null = null
    const revenueEstimate: number | null = null

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
      return NextResponse.json(
        { success: false, status: 'unavailable', message: 'No local event-clearing operation is implemented.' },
        { status: 501 },
      )
    }

    if (action === 'maintenance') {
      // Set maintenance mode
      await db.systemSetting.upsert({
        where: { key: 'maintenance_mode' },
        update: { value: 'true' },
        create: { key: 'maintenance_mode', value: 'true', type: 'boolean' },
      })
      return NextResponse.json({ success: true, message: 'Maintenance mode enabled' })
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
      return NextResponse.json(
        { success: false, status: 'unavailable', message: 'Use the authenticated scheduled sync pipeline; this admin action is not implemented.' },
        { status: 501 },
      )
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}