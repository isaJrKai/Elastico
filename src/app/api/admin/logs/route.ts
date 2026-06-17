import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if (auth instanceof Response) return auth
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const method = searchParams.get('method') || undefined
    const path = searchParams.get('path') || undefined
    const statusCode = searchParams.get('statusCode') ? parseInt(searchParams.get('statusCode')!, 10) : undefined
    const hasError = searchParams.get('hasError') === 'true'

    const where: Record<string, unknown> = {}
    if (method) where.method = method
    if (path) where.path = { contains: path, mode: 'insensitive' }
    if (statusCode) where.statusCode = statusCode
    if (hasError) where.error = { not: null }

    const [logs, total] = await Promise.all([
      db.apiLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.apiLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Admin logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}