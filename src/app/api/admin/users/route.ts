import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    const { user } = auth
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || undefined
    const plan = searchParams.get('plan') || undefined
    const role = searchParams.get('role') || undefined
    const status = searchParams.get('status') || undefined

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: 'page must be >= 1 and limit must be between 1 and 100' }, { status: 400 })
    }
    if (search && search.length > 100) {
      return NextResponse.json({ error: 'search must be 100 characters or fewer' }, { status: 400 })
    }
    if (plan && !['free', 'pro', 'elite'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan filter' }, { status: 400 })
    }
    if (role && !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role filter' }, { status: 400 })
    }
    if (status && !['banned', 'inactive', 'active'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    const q = search?.toLowerCase()
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { name: { contains: q } },
        { displayName: { contains: q } },
      ]
    }
    if (plan) where.plan = plan
    if (role) where.role = role
    if (status === 'banned') where.isBanned = true
    else if (status === 'inactive') where.isActive = false
    else if (status === 'active') where.isActive = true

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          plan: true,
          isActive: true,
          isBanned: true,
          banReason: true,
          predictionAccuracy: true,
          totalPredictions: true,
          correctPredictions: true,
          bestStreak: true,
          lastLoginAt: true,
          loginCount: true,
          failedLogins: true,
          lockedUntil: true,
          createdAt: true,
        },
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Admin users list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}