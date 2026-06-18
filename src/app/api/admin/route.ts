import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth instanceof Response) return auth
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  return auth
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
      totalMatches,
      totalPredictions,
      recentLogs,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { lastLoginAt: { gte: today } } }),
      db.user.count({ where: { plan: 'pro', isActive: true } }),
      db.user.count({ where: { plan: 'elite', isActive: true } }),
      db.match.count(),
      db.prediction.count(),
      db.apiLog.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        take: 1000,
        select: { statusCode: true },
      }),
    ])

    const errorCount = recentLogs.filter((l) => l.statusCode >= 400).length
    const totalRequests = recentLogs.length
    const errorRate = totalRequests > 0 ? Math.round((errorCount / totalRequests) * 1000) / 100 : 0

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
        totalApiCalls24h: totalRequests,
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

    const { action } = await req.json()

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (action === 'clearEvents') {
      const count = await db.matchEvent.deleteMany()
      // Reset match scores
      await db.match.updateMany({
        data: {
          status: 'upcoming',
          homeScore: 0,
          awayScore: 0,
          simulationMinute: 0,
        },
      })
      return NextResponse.json({ success: true, message: `Cleared ${count.count} events and reset match scores` })
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
      const { message, title, type } = await req.json()
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
      // Simulate a data sync operation
      const teamCount = await db.team.count()
      const playerCount = await db.player.count()
      const matchCount = await db.match.count()

      return NextResponse.json({
        success: true,
        message: 'Data sync completed',
        synced: { teams: teamCount, players: playerCount, matches: matchCount },
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Admin action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}